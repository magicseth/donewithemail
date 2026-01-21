declare module 'imap-simple' {
  export interface ImapSimpleOptions {
    imap: {
      user: string;
      password: string;
      host: string;
      port: number;
      tls: boolean;
      authTimeout: number;
    };
  }

  export interface Message {
    attributes: {
      uid: number;
      flags: string[];
      [key: string]: any;
    };
    parts: Array<{
      which: string;
      body: Buffer | string;
      [key: string]: any;
    }>;
  }

  export interface Connection {
    imap: {
      _box: {
        uidvalidity: number;
        [key: string]: any;
      };
      [key: string]: any;
    };
    openBox(boxName: string): Promise<void>;
    search(criteria: any[], fetchOptions: any): Promise<Message[]>;
    end(): void;
  }

  const imapSimple: {
    connect(options: ImapSimpleOptions): Promise<Connection>;
  };

  export default imapSimple;
}
