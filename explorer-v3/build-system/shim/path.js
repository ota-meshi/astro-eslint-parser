export const sep = "/";
export default {
  extname,
  isAbsolute,
  join,
  dirname,
  normalize,
  sep,
};

export function extname(p) {
  return /\.[^.]*$/.exec(p)?.[0];
}

export function isAbsolute() {
  return false;
}
export function join(...args) {
  return args.join("/");
}
export function dirname(p) {
  return p.split("/").slice(0, -1).join("/");
}
export function normalize(p) {
  return p;
}
