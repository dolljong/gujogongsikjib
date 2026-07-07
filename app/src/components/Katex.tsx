import { useMemo } from "react";
import katex from "katex";

export default function Katex({
  tex,
  display = true,
}: {
  tex: string;
  display?: boolean;
}) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<code>${tex}</code>`;
    }
  }, [tex, display]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
