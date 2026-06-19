import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Tailwind-styled element overrides so we don't need the typography plugin.
const components: Components = {
  h1: (p) => <h1 className="mb-2 mt-3 text-lg font-semibold" {...p} />,
  h2: (p) => <h2 className="mb-2 mt-3 text-base font-semibold" {...p} />,
  h3: (p) => <h3 className="mb-1 mt-2 text-sm font-semibold" {...p} />,
  p: (p) => <p className="my-2 leading-relaxed" {...p} />,
  ul: (p) => <ul className="my-2 list-disc space-y-1 pl-5" {...p} />,
  ol: (p) => <ol className="my-2 list-decimal space-y-1 pl-5" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  a: (p) => <a className="text-blue-600 underline" target="_blank" rel="noreferrer" {...p} />,
  strong: (p) => <strong className="font-semibold" {...p} />,
  blockquote: (p) => (
    <blockquote className="my-2 border-l-4 border-slate-200 pl-3 text-slate-600" {...p} />
  ),
  code: (p) => (
    <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em]" {...p} />
  ),
  table: (p) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...p} />
    </div>
  ),
  thead: (p) => <thead className="bg-slate-100" {...p} />,
  th: (p) => <th className="border border-slate-200 px-3 py-1.5 text-left font-semibold" {...p} />,
  td: (p) => <td className="border border-slate-200 px-3 py-1.5 align-top" {...p} />,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm text-slate-800">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
