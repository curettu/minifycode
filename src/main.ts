export type CodeMode = "html" | "css" | "js";

const compactCss = (source: string): string => {
  const strings: string[] = [];
  const protectedSource = source.replace(/(["'])(?:\\.|(?!\1)[\s\S])*\1/g, (value) => {
    strings.push(value);
    return `___MINIFYCODE_STRING_${strings.length - 1}___`;
  });
  const compacted = protectedSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>+~])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
  return compacted.replace(/___MINIFYCODE_STRING_(\d+)___/g, (_, index: string) => strings[Number(index)]);
};

const mangleLocals = (source: string): string => {
  const names = new Set<string>();
  const usedNames = new Set(source.match(/[A-Za-z_$][\w$]*/g) ?? []);
  const reserved = new Set("arguments await break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return static super switch this throw try typeof var void while with yield true false null undefined console window document Math JSON Array Object String Number Boolean Promise Date RegExp Error".split(" "));
  const depthAt = (position: number): number => {
    let depth = 0;
    let quote = "";
    for (let index = 0; index < position; index += 1) {
      const character = source[index];
      if (quote) {
        if (character === "\\") index += 1;
        else if (character === quote) quote = "";
      } else if (["'", '"', "`"].includes(character)) quote = character;
      else if (character === "{") depth += 1;
      else if (character === "}") depth -= 1;
    }
    return depth;
  };
  const declarations = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  let declaration: RegExpExecArray | null;
  while ((declaration = declarations.exec(source))) {
    if (depthAt(declaration.index) > 0 && !reserved.has(declaration[1])) names.add(declaration[1]);
  }
  const namedDeclarations = /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|\bclass\s+([A-Za-z_$][\w$]*)/g;
  let namedDeclaration: RegExpExecArray | null;
  while ((namedDeclaration = namedDeclarations.exec(source))) {
    const name = namedDeclaration[1] ?? namedDeclaration[2];
    if (name && !reserved.has(name)) names.add(name);
  }
  const functionParameters = /\b(?:async\s+)?function\s*[\w$]*\s*\(([^)]*)\)/g;
  let functionParameter: RegExpExecArray | null;
  while ((functionParameter = functionParameters.exec(source))) {
    functionParameter[1].split(",").map((item) => item.trim().replace(/[={}].*$/, "")).filter((item) => /^[A-Za-z_$][\w$]*$/.test(item) && !reserved.has(item)).forEach((item) => names.add(item));
  }
  const parameters = /(?:\(([^)]*)\)|\b([A-Za-z_$][\w$]*)\s*)\s*=>/g;
  let parameter: RegExpExecArray | null;
  while ((parameter = parameters.exec(source))) {
    const list = parameter[1] ?? parameter[2] ?? "";
    if (depthAt(parameter.index) > 0 || source[parameter.index + parameter[0].length - 1] === ">") {
      list.split(",").map((item) => item.trim().replace(/[={}].*$/, "")).filter((item) => /^[A-Za-z_$][\w$]*$/.test(item) && !reserved.has(item)).forEach((item) => names.add(item));
    }
  }
  const replacements = new Map<string, string>();
  let candidate = 0;
  for (const name of names) {
    let shortName: string;
    do { shortName = String.fromCharCode(97 + (candidate++ % 26)) + (candidate > 26 ? Math.floor(candidate / 26) : ""); } while (reserved.has(shortName) || usedNames.has(shortName));
    replacements.set(name, shortName);
    usedNames.add(shortName);
  }
  if (!replacements.size) return source;
  let cursor = 0;
  let quote = "";
  return source.replace(/([A-Za-z_$][\w$]*)/g, (token, _match, offset: number) => {
    for (let index = cursor; index < offset; index += 1) {
      if (quote) {
        if (source[index] === "\\") index += 1;
        else if (source[index] === quote) quote = "";
      } else if (["'", '"', "`"].includes(source[index])) quote = source[index];
    }
    cursor = offset + token.length;
    if (quote) return token;
    const before = source.slice(0, offset).trimEnd();
    const after = source.slice(offset + token.length).trimStart();
    if (before.endsWith(".") || after.startsWith(":") || reserved.has(token)) return token;
    return replacements.get(token) ?? token;
  });
};

const compactJavaScript = (source: string): string => {
  let output = "";
  let quote = "";
  let comment = "";
  let pendingSpace = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1] ?? "";
    if (comment === "line") {
      if (character === "\n") comment = "";
      continue;
    }
    if (comment === "block") {
      if (character === "*" && next === "/") { comment = ""; index += 1; }
      continue;
    }
    if (quote) {
      output += character;
      if (character === "\\") output += source[++index] ?? "";
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "/" && next === "/") { comment = "line"; index += 1; continue; }
    if (character === "/" && next === "*") { comment = "block"; index += 1; continue; }
    if (["'", '"', "`"].includes(character)) quote = character;
    if (/\s/.test(character)) { pendingSpace = true; continue; }
    if (pendingSpace && /[\w$]/.test(output.charAt(output.length - 1)) && /[\w$]/.test(character)) output += " ";
    pendingSpace = false;
    output += character;
  }
  return mangleLocals(output.trim()).replace(/;(?=})/g, "");
};

export const minifyCode = (source: string, mode: CodeMode): string => {
  if (mode === "css") return compactCss(source);
  if (mode === "js") return compactJavaScript(source);
  const blocks: string[] = [];
  const protectedSource = source.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (block) => {
    blocks.push(block);
    return `___MINIFYCODE_BLOCK_${blocks.length - 1}___`;
  });
  const compacted = protectedSource.replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
  return compacted.replace(/___MINIFYCODE_BLOCK_(\d+)___/g, (_, index: string) => {
    const block = blocks[Number(index)];
    return block.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/i, (_, open: string, content: string, close: string) => `${open}${compactJavaScript(content)}${close}`)
      .replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/i, (_, open: string, content: string, close: string) => `${open}${compactCss(content)}${close}`);
  });
};
