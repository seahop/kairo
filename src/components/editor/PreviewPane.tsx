import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useNoteStore } from "@/stores/noteStore";

export function PreviewPane() {
  const { editorContent } = useNoteStore();

  return (
    <div className="h-full overflow-auto bg-dark-950 p-6">
      <div className="max-w-3xl mx-auto markdown-preview">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // Custom rendering for code blocks
            code({ node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const isInline = !match;

              if (isInline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }

              return (
                <div className="relative group">
                  <div className="absolute top-2 right-2 text-xs text-dark-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {match[1]}
                  </div>
                  <pre className={className}>
                    <code {...props}>{children}</code>
                  </pre>
                </div>
              );
            },
            // Custom rendering for links
            a({ href, children, ...props }) {
              // Check if it's an internal wiki link
              if (href?.startsWith("[[") && href?.endsWith("]]")) {
                const notePath = href.slice(2, -2);
                return (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      // TODO: Navigate to note
                      console.log("Navigate to:", notePath);
                    }}
                    className="text-accent-primary hover:text-accent-secondary"
                    {...props}
                  >
                    {children}
                  </a>
                );
              }

              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                >
                  {children}
                </a>
              );
            },
            // Custom checkbox rendering for task lists
            input({ checked, ...props }) {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mr-2 accent-accent-primary"
                  {...props}
                />
              );
            },
          }}
        >
          {editorContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}
