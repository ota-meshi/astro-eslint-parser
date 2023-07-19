export default new Proxy(
  {},
  {
    get(target, key) {
      // eslint-disable-next-line no-console -- Demo
      console.log(key);
      if (key === "inspect") {
        return {};
      }
      return target[key];
    },
  },
);
