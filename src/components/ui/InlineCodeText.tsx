/** Renders plain text where `backticked` spans become inline code (used for finding explanations and fixes). */
export function InlineCodeText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.length > 2 && part.startsWith('`') && part.endsWith('`') ? (
          <code key={i} className="code-inline">{part.slice(1, -1)}</code>
        ) : (
          part
        )
      )}
    </>
  );
}
