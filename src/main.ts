export type CodeMode = "html" | "css" | "js";

const compactCss = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")
  .replace(/\s*([{}:;,>+~])\s*/g, "$1")
  .replace(/;}/g, "}")
  .trim();

const compactJavaScript = (source: string): string => {
  let output = "";
  let quote = "";
  let pendingSpace = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      output += character;
      if (character === "\\") output += source[++index] ?? "";
      else if (character === quote) quote = "";
      continue;
    }
    if (["'", '"', "`"].includes(character)) quote = character;
    if (/\s/.test(character)) { pendingSpace = true; continue; }
    if (pendingSpace && /[\w$]/.test(output.at(-1) ?? "") && /[\w$]/.test(character)) output += " ";
    pendingSpace = false;
    output += character;
  }
  return output.trim();
};

export const minifyCode = (source: string, mode: CodeMode): string => {
  if (mode === "css") return compactCss(source);
  if (mode === "js") return compactJavaScript(source);
  return source.replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
};
