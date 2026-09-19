export function readFlags(args: readonly string[]) {
  const flags = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || !value)
      throw new Error(`Invalid argument near ${key ?? '<end>'}.`);
    flags.set(key.slice(2), value);
  }
  return {
    require(name: string) {
      const value = flags.get(name);
      if (!value) throw new Error(`Missing required --${name}.`);
      return value;
    },
  };
}
