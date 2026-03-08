import type * as BcryptModule from "bcrypt";

let cached: typeof BcryptModule | null = null;

function getBcrypt(): typeof BcryptModule {
  if (!cached) {
    cached = eval("require")("bcrypt") as typeof BcryptModule;
  }
  return cached;
}

const bcrypt = {
  hash(data: string | Buffer, saltOrRounds: string | number) {
    return getBcrypt().hash(data, saltOrRounds);
  },
  compare(data: string | Buffer, encrypted: string) {
    return getBcrypt().compare(data, encrypted);
  }
};

export default bcrypt;
