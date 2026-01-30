'use client'

import { useMemo, useState, Fragment } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageViewer } from '@/components/artifacts/ImageViewer'
import { FileDownload } from '@/components/artifacts/FileDownload'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MarkdownRendererProps {
  content: string
  className?: string
}

// Math component that renders KaTeX
function Math({ latex, display }: { latex: string; display: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
        strict: false,
        trust: true,
      })
    } catch (e) {
      console.error('KaTeX error:', e)
      return null
    }
  }, [latex, display])

  if (!html) {
    return <code className="text-red-500 bg-red-50 px-1 rounded">{latex}</code>
  }

  return (
    <span
      className={display ? 'block my-4 overflow-x-auto text-center' : 'inline'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// Extract math expressions and replace with placeholders
function extractMath(content: string): { text: string; mathExpressions: Map<string, { latex: string; display: boolean }> } {
  const mathExpressions = new Map<string, { latex: string; display: boolean }>()
  let counter = 0
  let text = content

  // Helper to create placeholder (use format that won't be parsed as markdown)
  const createPlaceholder = (latex: string, display: boolean): string => {
    const id = `⟦MATH${counter++}⟧`
    mathExpressions.set(id, { latex: latex.trim(), display })
    return id
  }

  // 1. Convert multiline [ ... ] blocks with LaTeX to $$ ... $$
  // Backend format: [ on its own line, LaTeX content, ] on its own line
  text = text.replace(
    /^\[\s*\n([\s\S]*?)\n\s*\]$/gm,
    (match, inner) => {
      if (/\\[a-zA-Z]+/.test(inner)) {
        return `$$${inner.trim()}$$`
      }
      return match
    }
  )

  // 2. Also handle single-line [ ... ] blocks
  text = text.replace(
    /\[\s*((?:[^[\]\n]*\\[a-zA-Z]+[^[\]\n]*)+)\s*\]/g,
    (match, inner) => {
      if (/\\[a-zA-Z]+/.test(inner)) {
        return `$$${inner.trim()}$$`
      }
      return match
    }
  )

  // 3. Extract $$ ... $$ (block math)
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => createPlaceholder(latex, true))

  // 4. Extract \[ ... \] (block math)
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => createPlaceholder(latex, true))

  // 5. Extract $ ... $ (inline math, not $$)
  text = text.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (_, latex) => createPlaceholder(latex, false))

  // 6. Extract \( ... \) (inline math)
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => createPlaceholder(latex, false))

  return { text, mathExpressions }
}

// Component to render text with math placeholders
function TextWithMath({ 
  children, 
  mathExpressions 
}: { 
  children: string
  mathExpressions: Map<string, { latex: string; display: boolean }> 
}) {
  const parts = useMemo(() => {
    const result: React.ReactNode[] = []
    const regex = /⟦MATH\d+⟧/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(children)) !== null) {
      // Add text before the placeholder
      if (match.index > lastIndex) {
        result.push(children.slice(lastIndex, match.index))
      }

      // Add the math component
      const mathData = mathExpressions.get(match[0])
      if (mathData) {
        result.push(
          <Math key={match[0]} latex={mathData.latex} display={mathData.display} />
        )
      } else {
        result.push(match[0])
      }

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < children.length) {
      result.push(children.slice(lastIndex))
    }

    return result
  }, [children, mathExpressions])

  return <>{parts}</>
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const { text: processedContent, mathExpressions } = useMemo(
    () => extractMath(content),
    [content]
  )

  // Wrapper component to inject math rendering into text
  const renderWithMath = (text: React.ReactNode): React.ReactNode => {
    if (typeof text === 'string' && text.includes('⟦MATH')) {
      return <TextWithMath mathExpressions={mathExpressions}>{text}</TextWithMath>
    }
    return text
  }

  // Process children recursively
  const processChildren = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === 'string') {
      return renderWithMath(children)
    }
    if (Array.isArray(children)) {
      return children.map((child, i) => (
        <Fragment key={i}>{processChildren(child)}</Fragment>
      ))
    }
    return children
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks with syntax highlighting
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const language = match ? match[1] : ''
            const codeString = String(children).replace(/\n$/, '')

            if (!inline && language) {
              return <CodeBlock code={codeString} language={language} {...props} />
            }

            return (
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...props}>
                {children}
              </code>
            )
          },

          // Paragraphs - process math
          p({ node, children, ...props }: any) {
            return (
              <p className="my-2 leading-7" {...props}>
                {processChildren(children)}
              </p>
            )
          },

          // List items - process math
          li({ node, children, ...props }: any) {
            return <li {...props}>{processChildren(children)}</li>
          },

          // Headings - process math
          h1({ node, children, ...props }: any) {
            return (
              <h1 className="mb-4 mt-6 text-2xl font-bold" {...props}>
                {processChildren(children)}
              </h1>
            )
          },
          h2({ node, children, ...props }: any) {
            return (
              <h2 className="mb-3 mt-5 text-xl font-semibold" {...props}>
                {processChildren(children)}
              </h2>
            )
          },
          h3({ node, children, ...props }: any) {
            return (
              <h3 className="mb-2 mt-4 text-lg font-semibold" {...props}>
                {processChildren(children)}
              </h3>
            )
          },

          // Images
          img({ node, src, alt, title, ...props }: any) {
            if (!src) return null

            if (src.startsWith('/files/') || !src.startsWith('http')) {
              return <ImageViewer src={src} alt={alt} title={title} />
            }

            return (
              <div className="my-4 rounded-lg border bg-muted/50 p-4">
                {title && (
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    {title}
                  </p>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt || title || 'Image'}
                  className="max-h-[600px] w-full object-contain"
                  {...props}
                />
              </div>
            )
          },

          // Links
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
              <th className="px-4 py-2 text-left text-sm font-semibold" {...props}>
                {processChildren(children)}
              </th>
            )
          },
          td({ node, children, ...props }: any) {
            return (
              <td className="border-t border-border px-4 py-2 text-sm" {...props}>
                {processChildren(children)}
              </td>
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

          // Blockquotes
          blockquote({ node, children, ...props }: any) {
            return (
              <blockquote
                className="my-4 border-l-4 border-primary/30 bg-muted/50 pl-4 italic"
                {...props}
              >
                {processChildren(children)}
              </blockquote>
            )
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
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
