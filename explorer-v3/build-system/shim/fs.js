function existsSync() {
  return false;
}

function noop() {
  // noop
}

const writeFileSync = noop;
const unlinkSync = noop;

export { existsSync, writeFileSync, unlinkSync };
export default { existsSync, writeFileSync, unlinkSync };
