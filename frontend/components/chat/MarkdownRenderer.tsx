'use client'

import { useMemo, Fragment } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ImageViewer } from '@/components/artifacts/ImageViewer'
import { FileDownload } from '@/components/artifacts/FileDownload'
import 'katex/dist/katex.min.css'
import katex from 'katex'

interface MarkdownRendererProps {
  content: string
  className?: string
}

// Pre-process LaTeX to fix common issues from LLM output
function preprocessLatex(latex: string): string {
  let processed = latex

  // Fix underscores inside \text{} - they need to be escaped or use \_ 
  // Match \text{...} and escape underscores inside
  processed = processed.replace(/\\text\{([^}]*)\}/g, (match, content) => {
    // Replace _ with \_ inside \text, but not if already escaped
    const fixed = content.replace(/(?<!\\)_/g, '\\_')
    return `\\text{${fixed}}`
  })

  // Fix spaces in \text{} - use explicit space or ~
  processed = processed.replace(/\\text\{([^}]*)\}/g, (match, content) => {
    // Replace multiple spaces with single ~
    const fixed = content.replace(/\s+/g, '~')
    return `\\text{${fixed}}`
  })

  // Fix {,} thousand separator - should be {\,} for proper spacing or just ,
  processed = processed.replace(/\{,\}/g, '{,}')

  // Handle common issues with 100,000 style numbers in LaTeX
  processed = processed.replace(/(\d)\{,\}(\d)/g, '$1{,}$2')

  return processed
}

// Render LaTeX to HTML string
function renderLatex(latex: string, displayMode: boolean): string {
  try {
    const processed = preprocessLatex(latex)
    return katex.renderToString(processed, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
    })
  } catch (e) {
    console.error('KaTeX error:', e, 'LaTeX:', latex)
    // Try a more aggressive fix
    try {
      // Escape all problematic characters
      let fallback = latex
        .replace(/(?<!\\)_/g, '\\_')  // Escape unescaped underscores globally
        .replace(/(?<!\\)#/g, '\\#')  // Escape hash
        .replace(/(?<!\\)%/g, '\\%')  // Escape percent
      
      return katex.renderToString(fallback, {
        displayMode,
        throwOnError: false,
        strict: false,
        trust: true,
      })
    } catch (e2) {
      console.error('KaTeX fallback error:', e2)
      return `<code class="text-orange-600 bg-orange-50 px-1 rounded text-sm">${latex}</code>`
    }
  }
}

// Component to render HTML from KaTeX
function MathBlock({ latex, display }: { latex: string; display: boolean }) {
  const html = useMemo(() => renderLatex(latex, display), [latex, display])
  return (
    <span
      className={display ? 'block my-4 overflow-x-auto' : 'inline'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// Extract raw LaTeX expression starting at position, handling nested braces
function extractLatexExpression(text: string, startIndex: number): string | null {
  let i = startIndex
  let braceDepth = 0
  let started = false
  
  while (i < text.length) {
    const char = text[i]
    
    if (char === '{') {
      braceDepth++
      started = true
    } else if (char === '}') {
      braceDepth--
      if (started && braceDepth === 0) {
        // Check if there's more LaTeX after this (like \times, =, etc.)
        const rest = text.slice(i + 1)
        const continueMatch = rest.match(/^(\s*(?:\\times|\\quad|\s*=\s*|\\frac|\\text)\s*)/)
        if (continueMatch) {
          i += continueMatch[0].length
          continue
        }
        // Check for trailing number like \times 100
        const numberMatch = rest.match(/^(\s*[\d{,}]+)/)
        if (numberMatch) {
          return text.slice(startIndex, i + 1 + numberMatch[0].length)
        }
        return text.slice(startIndex, i + 1)
      }
    } else if (braceDepth === 0 && started) {
      // Outside braces after completing an expression
      const nextPart = text.slice(i)
      if (nextPart.match(/^\s*(?:\\times|\\quad|=|\\frac|\\text)/)) {
        // Continue parsing
        const cmdMatch = nextPart.match(/^\s*(\\[a-zA-Z]+|=)/)
        if (cmdMatch) {
          i += cmdMatch[0].length - 1
        }
      } else {
        return text.slice(startIndex, i)
      }
    }
    i++
  }
  
  return started ? text.slice(startIndex, i) : null
}

// Check if text contains LaTeX commands
function containsLatex(text: string): boolean {
  return /\\(?:frac|text|sum|times|quad|sqrt|int|prod|lim|log|sin|cos|tan|alpha|beta|gamma|delta|lambda|mu|sigma|pi|infty|partial|nabla|pm|mp|cdot|ldots|cdots|leq|geq|neq|approx|equiv|subset|supset|cap|cup|in|notin|forall|exists|mathbb|mathcal|mathrm|hat|bar|vec|dot|tilde|left|right|big|Big|bigg|Bigg)[{_^]?/.test(text)
}

// Process text to find and render LaTeX expressions
function processTextWithMath(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = []
  let key = 0

  let segments: { type: 'text' | 'math'; content: string; display: boolean }[] = []
  
  // Pattern 1: $$ ... $$ (block math)
  // Pattern 2: \[ ... \] (block math)  
  // Pattern 3: [ ... ] containing LaTeX (block math from LLM)
  // Pattern 4: $ ... $ (inline math)
  // Pattern 5: \( ... \) (inline math)
  
  // Use a more permissive approach for [ ... ] blocks
  const mathPatterns = [
    { regex: /\$\$([\s\S]*?)\$\$/g, display: true },
    { regex: /\\\[([\s\S]*?)\\\]/g, display: true },
    { regex: /\$([^\$\n]+?)\$/g, display: false },
    { regex: /\\\(([^\)]+?)\\\)/g, display: false },
  ]
  
  // First, find all [ ... ] blocks that contain LaTeX
  const bracketBlockRegex = /\[\s*([\s\S]*?)\s*\]/g
  const bracketMathBlocks: { start: number; end: number; content: string }[] = []
  
  let bracketMatch
  while ((bracketMatch = bracketBlockRegex.exec(text)) !== null) {
    const content = bracketMatch[1]
    // Check if this looks like LaTeX (contains backslash commands)
    if (containsLatex(content)) {
      bracketMathBlocks.push({
        start: bracketMatch.index,
        end: bracketMatch.index + bracketMatch[0].length,
        content: content.trim()
      })
    }
  }
  
  // Build segments from bracket math blocks first
  let currentIndex = 0
  for (const block of bracketMathBlocks) {
    if (block.start > currentIndex) {
      segments.push({ type: 'text', content: text.slice(currentIndex, block.start), display: false })
    }
    segments.push({ type: 'math', content: block.content, display: true })
    currentIndex = block.end
  }
  if (currentIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(currentIndex), display: false })
  }
  
  // Now process text segments for other math patterns ($, $$, \[, \()
  const finalSegments: typeof segments = []
  
  for (const seg of segments) {
    if (seg.type === 'math') {
      finalSegments.push(seg)
      continue
    }
    
    let textContent = seg.content
    let foundMath = false
    
    // Try each math pattern
    for (const { regex, display } of mathPatterns) {
      regex.lastIndex = 0
      let match
      let segLastIndex = 0
      const tempSegments: typeof segments = []
      
      while ((match = regex.exec(textContent)) !== null) {
        foundMath = true
        if (match.index > segLastIndex) {
          tempSegments.push({ type: 'text', content: textContent.slice(segLastIndex, match.index), display: false })
        }
        tempSegments.push({ type: 'math', content: match[1].trim(), display })
        segLastIndex = match.index + match[0].length
      }
      
      if (foundMath) {
        if (segLastIndex < textContent.length) {
          tempSegments.push({ type: 'text', content: textContent.slice(segLastIndex), display: false })
        }
        // Process these segments recursively for remaining patterns
        for (const ts of tempSegments) {
          finalSegments.push(ts)
        }
        break
      }
    }
    
    if (!foundMath) {
      finalSegments.push(seg)
    }
  }
  
  // Second pass: process text segments for raw LaTeX (no delimiters)
  const processedSegments: typeof finalSegments = []
  
  for (const seg of finalSegments) {
    if (seg.type === 'math') {
      processedSegments.push(seg)
      continue
    }
    
    // Look for raw LaTeX in text: \text{...}, \frac{...}, etc.
    const rawLatexRegex = /\\(?:text|frac|times|sum|quad|sqrt)\{/g
    let textContent = seg.content
    let rawMatch
    let rawLastIndex = 0
    
    while ((rawMatch = rawLatexRegex.exec(textContent)) !== null) {
      if (rawMatch.index > rawLastIndex) {
        const before = textContent.slice(rawLastIndex, rawMatch.index)
        if (before.trim()) {
          processedSegments.push({ type: 'text', content: before, display: false })
        }
      }
      
      const extracted = extractLatexExpression(textContent, rawMatch.index)
      if (extracted) {
        processedSegments.push({ type: 'math', content: extracted, display: false })
        rawLastIndex = rawMatch.index + extracted.length
        rawLatexRegex.lastIndex = rawLastIndex
      } else {
        rawLastIndex = rawMatch.index + rawMatch[0].length
      }
    }
    
    if (rawLastIndex < textContent.length) {
      const remaining = textContent.slice(rawLastIndex)
      if (remaining.trim()) {
        processedSegments.push({ type: 'text', content: remaining, display: false })
      }
    } else if (rawLastIndex === 0 && textContent.trim()) {
      processedSegments.push(seg)
    }
  }
  
  // Convert to React nodes
  for (const seg of processedSegments) {
    if (seg.type === 'math') {
      result.push(<MathBlock key={key++} latex={seg.content} display={seg.display} />)
    } else {
      result.push(<Fragment key={key++}>{seg.content}</Fragment>)
    }
  }

  return result.length > 0 ? result : [<Fragment key={0}>{text}</Fragment>]
}

// Custom text renderer that handles math
function TextWithMath({ children }: { children: string }) {
  const processed = useMemo(() => processTextWithMath(children), [children])
  return <>{processed}</>
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Pre-process content to normalize LaTeX delimiters
  const transformedContent = useMemo(() => {
    let transformed = content

    // Transform image markdown paths
    transformed = transformed.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, alt, src) => {
        if (src.startsWith('/files/')) {
          return `![${alt}](${src})`
        }
        return match
      }
    )

    return transformed
  }, [content])

  // Split content into segments: markdown and math blocks
  const segments = useMemo(() => {
    const result: { type: 'markdown' | 'math'; content: string; display?: boolean }[] = []
    
    // Regex to find block-level math that should be rendered separately
    // This handles [ ... ] blocks with LaTeX that span multiple lines
    const blockMathRegex = /^\[\s*\n([\s\S]*?)\n\s*\]$/gm
    
    let lastIndex = 0
    let match
    
    // First pass: extract multi-line block math
    const tempContent = transformedContent.replace(blockMathRegex, (m, latex) => {
      if (latex.match(/\\[a-zA-Z]+|\\frac|\\text|\\sum|\\times|\^|_/)) {
        return `\n$$${latex.trim()}$$\n`
      }
      return m
    })

    result.push({ type: 'markdown', content: tempContent })
    return result
  }, [transformedContent])

  return (
    <div className={className}>
      {segments.map((segment, idx) => {
        if (segment.type === 'math') {
          return <MathBlock key={idx} latex={segment.content} display={segment.display!} />
        }
        
        return (
          <ReactMarkdown
            key={idx}
            remarkPlugins={[remarkGfm]}
            components={{
              // Process text nodes to render inline math
              text({ node, ...props }: any) {
                const value = (node as any)?.value || ''
                if (typeof value === 'string' && (value.includes('$') || value.includes('[') || value.includes('\\'))) {
                  return <TextWithMath>{value}</TextWithMath>
                }
                return <>{value}</>
              },

              // Code blocks with syntax highlighting
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '')
                const language = match ? match[1] : ''
                const codeString = String(children).replace(/\n$/, '')

                if (!inline && language) {
                  return (
                    <CodeBlock code={codeString} language={language} {...props} />
                  )
                }

                return (
                  <code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...props}>
                    {children}
                  </code>
                )
              },

              // Paragraphs - check for math content
              p({ node, children, ...props }: any) {
                // Convert children to string to check for math
                const childArray = Array.isArray(children) ? children : [children]
                const processedChildren = childArray.map((child, i) => {
                  if (typeof child === 'string') {
                    // Check if contains math delimiters
                    if (child.includes('$$') || child.includes('\\[') || child.includes('\\(') || 
                        (child.includes('[') && child.match(/\[\s*\\[a-zA-Z]/))) {
                      return <TextWithMath key={i}>{child}</TextWithMath>
                    }
                    // Check for inline [ ... ] math patterns
                    if (child.match(/\[\s*(?:\\[a-zA-Z]+|\\frac|\\text)/)) {
                      return <TextWithMath key={i}>{child}</TextWithMath>
                    }
                  }
                  return child
                })

                return (
                  <p className="my-2 leading-7" {...props}>
                    {processedChildren}
                  </p>
                )
              },

              // Images - transform URLs to backend
              img({ node, src, alt, title, ...props }: any) {
                if (!src) return null

                if (src.startsWith('/files/') || !src.startsWith('http')) {
                  return (
                    <ImageViewer
                      src={src}
                      alt={alt}
                      title={title}
                    />
                  )
                }

                return (
                  <div className="my-4 rounded-lg border bg-muted/50 p-4">
                    {title && (
                      <p className="mb-2 text-sm font-medium text-muted-foreground">
                        {title}
                      </p>
                    )}
                    <img
                      src={src}
                      alt={alt || title || 'Image'}
                      className="max-h-[600px] w-full object-contain"
                      {...props}
                    />
                  </div>
                )
              },

              // Links - check if they're download links
              a({ node, href, children, ...props }: any) {
                if (!href) return <a {...props}>{children}</a>

                if (
                  href.startsWith('/files/') ||
                  href.match(/\.(pdf|csv|xlsx|xls|png|jpg|jpeg)$/i)
                ) {
                  return (
                    <FileDownload href={href} filename={String(children)}>
                      {children}
                    </FileDownload>
                  )
                }

                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:text-primary/80"
                    {...props}
                  >
                    {children}
                  </a>
                )
              },

              // Tables
              table({ node, children, ...props }: any) {
                return (
                  <div className="my-4 overflow-x-auto">
                    <table
                      className="min-w-full divide-y divide-border border border-border"
                      {...props}
                    >
                      {children}
                    </table>
                  </div>
                )
              },
              thead({ node, children, ...props }: any) {
                return (
                  <thead className="bg-muted" {...props}>
                    {children}
                  </thead>
                )
              },
              th({ node, children, ...props }: any) {
                return (
                  <th
                    className="px-4 py-2 text-left text-sm font-semibold"
                    {...props}
                  >
                    {children}
                  </th>
                )
              },
              td({ node, children, ...props }: any) {
                return (
                  <td className="border-t border-border px-4 py-2 text-sm" {...props}>
                    {children}
                  </td>
                )
              },

              // Headings
              h1({ node, children, ...props }: any) {
                return (
                  <h1 className="mb-4 mt-6 text-2xl font-bold" {...props}>
                    {children}
                  </h1>
                )
              },
              h2({ node, children, ...props }: any) {
                return (
                  <h2 className="mb-3 mt-5 text-xl font-semibold" {...props}>
                    {children}
                  </h2>
                )
              },
              h3({ node, children, ...props }: any) {
                return (
                  <h3 className="mb-2 mt-4 text-lg font-semibold" {...props}>
                    {children}
                  </h3>
                )
              },

              // Lists
              ul({ node, children, ...props }: any) {
                return (
                  <ul className="my-2 ml-6 list-disc space-y-1" {...props}>
                    {children}
                  </ul>
                )
              },
              ol({ node, children, ...props }: any) {
                return (
                  <ol className="my-2 ml-6 list-decimal space-y-1" {...props}>
                    {children}
                  </ol>
                )
              },

              // List items - handle math in list items
              li({ node, children, ...props }: any) {
                const childArray = Array.isArray(children) ? children : [children]
                const processedChildren = childArray.map((child, i) => {
                  if (typeof child === 'string') {
                    if (child.match(/\[\s*(?:\\[a-zA-Z]+|\\frac|\\text)/) || 
                        child.includes('$$') || child.includes('$')) {
                      return <TextWithMath key={i}>{child}</TextWithMath>
                    }
                  }
                  return child
                })
                return <li {...props}>{processedChildren}</li>
              },

              // Blockquotes
              blockquote({ node, children, ...props }: any) {
                return (
                  <blockquote
                    className="my-4 border-l-4 border-primary/30 bg-muted/50 pl-4 italic"
                    {...props}
                  >
                    {children}
                  </blockquote>
                )
              },
            }}
          >
            {segment.content}
          </ReactMarkdown>
        )
      })}
    </div>
  )
}

// Code block component with copy button
function CodeBlock({ code, language, ...props }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative my-4">
      <div className="absolute right-2 top-2 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          borderRadius: '0.5rem',
          padding: '1rem',
          fontSize: '0.875rem',
        }}
        {...props}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
