export interface ISerializer {
  serialize(data: unknown): string;
  deserialize<T = unknown>(json: string): T;
  clone<T>(data: T): T;
}

export class JsonSerializer implements ISerializer {
  serialize(data: unknown): string {
    return JSON.stringify(data);
  }

  deserialize<T = unknown>(json: string): T {
    return JSON.parse(json) as T;
  }

  clone<T>(data: T): T {
    return JSON.parse(JSON.stringify(data)) as T;
  }
}
