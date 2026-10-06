import { Fragment, type ReactNode } from "react";
import { parseRichText, type RichInline } from "@store-builder/api-client";

/**
 * A formatted description (headings, lists, bold, italic, links) drawn from
 * its marks (api-client endpoints/richText.ts). Only these elements are ever
 * made, and every character of the text is escaped by React — there is no
 * HTML in a description to inject.
 */

function Inline({ nodes }: { nodes: RichInline[] }): ReactNode {
  return nodes.map((node, i) => {
    if (node.type === "text") return <Fragment key={i}>{node.text}</Fragment>;
    if (node.type === "bold") {
      return (
        <strong key={i} className="font-semibold text-ink">
          <Inline nodes={node.children} />
        </strong>
      );
    }
    if (node.type === "italic") {
      return (
        <em key={i}>
          <Inline nodes={node.children} />
        </em>
      );
    }
    const external = /^https?:/i.test(node.href);
    return (
      <a
        key={i}
        href={node.href}
        className="font-medium text-primary underline underline-offset-2"
        {...(external ? { target: "_blank", rel: "nofollow noopener noreferrer" } : {})}
      >
        <Inline nodes={node.children} />
      </a>
    );
  });
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = parseRichText(text);
  if (blocks.length === 0) return null;
  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <h3 key={i} className="font-display text-lg font-semibold text-ink">
              <Inline nodes={block.content} />
            </h3>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={i} className={`space-y-1 ps-5 ${block.ordered ? "list-decimal" : "list-disc"}`}>
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inline nodes={item} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inline nodes={line} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
