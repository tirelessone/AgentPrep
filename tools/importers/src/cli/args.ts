export function readFlags(args: readonly string[]) {
  const normalizedArgs = args[0] === '--' ? args.slice(1) : args;
  const flags = new Map<string, string>();
  for (let index = 0; index < normalizedArgs.length; index += 2) {
    const key = normalizedArgs[index];
    const value = normalizedArgs[index + 1];
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
