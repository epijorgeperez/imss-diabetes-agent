'use client'

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ImageViewer } from '@/components/artifacts/ImageViewer'
import { FileDownload } from '@/components/artifacts/FileDownload'
import { getBackendFileUrl } from '@/lib/api-client'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Transform markdown content to handle image URLs and download links
  const transformedContent = useMemo(() => {
    let transformed = content

    // Transform image markdown: ![alt](/files/outputs/image.png) 
    // This is handled in the image component renderer, but we ensure paths are correct
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

          // Images - transform URLs to backend
          img({ node, src, alt, title, ...props }: any) {
            if (!src) return null

            // Check if it's a file path that needs transformation
            if (src.startsWith('/files/') || !src.startsWith('http')) {
              return (
                <ImageViewer
                  src={src}
                  alt={alt}
                  title={title}
                />
              )
            }

            // External image
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

            // Check if it's a file download link
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

            // Regular link
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

          // Tables - styled with remark-gfm
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

          // Paragraphs
          p({ node, children, ...props }: any) {
            return (
              <p className="my-2 leading-7" {...props}>
                {children}
              </p>
            )
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
        {transformedContent}
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

