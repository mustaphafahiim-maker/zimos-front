import { createElement } from "react";
import { headNodeProps, parseHeadCode, SERVER_HEAD_ATTR } from "@/lib/headCodeParse";

/**
 * The merchant's head code and stylesheet, in the server's <head>
 * (lib/headCodeParse explains the split). Each element carries
 * SERVER_HEAD_ATTR so the browser side (components/CustomCode.tsx) knows they
 * are already there, adds only what could not be rendered here, and can switch
 * the stylesheet off on a page where merchant code must not apply.
 */
export function HeadCode({ head, css }: { head: string; css: string }) {
  const { nodes } = parseHeadCode(head);
  const mark = { [SERVER_HEAD_ATTR]: "" };
  return (
    <>
      {nodes.map((node, i) =>
        node.body !== undefined
          ? createElement(node.tag, { key: i, ...headNodeProps(node), ...mark, dangerouslySetInnerHTML: { __html: node.body } })
          : createElement(node.tag, { key: i, ...headNodeProps(node), ...mark })
      )}
      {css.trim() && <style {...mark} data-zimos-slot="css" dangerouslySetInnerHTML={{ __html: css }} />}
    </>
  );
}
