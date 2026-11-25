// Rich text урока (COURSE-03): markdown → HTML c санитайзом (контент вводит админ,
// но XSS в кабинете школьника недопустим — чистим всегда).
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";

export default function RichText({ markdown }: { markdown: string }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(markdown, { async: false })),
    [markdown],
  );
  return <div className="rich-text" dangerouslySetInnerHTML={{ __html: html }} />;
}
