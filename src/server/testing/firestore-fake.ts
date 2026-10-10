import "server-only";

/** Atomic in-memory Firestore double. Test-only; never imported by runtime modules. */
type Ref = { path: string };
function snapshot(value: unknown) {
  return { exists: value !== undefined, data: () => structuredClone(value) };
}
export class FirestoreFake {
  readonly documents = new Map<string, unknown>();
  private tail: Promise<void> = Promise.resolve();
  collection(name: string) {
    return { doc: (id: string) => ({
      path: name + "/" + id,
      get: async () => snapshot(this.documents.get(name + "/" + id)),
    }) };
  }
  runTransaction<T>(run: (transaction: {
    get: (ref: Ref) => Promise<ReturnType<typeof snapshot>>;
    create: (ref: Ref, data: unknown) => void;
    set: (ref: Ref, data: unknown) => void;
    update: (ref: Ref, data: Record<string, unknown>) => void;
    delete: (ref: Ref) => void;
  }) => Promise<T>): Promise<T> {
    const operation = this.tail.then(async () => {
      const writes: Array<() => void> = [];
      const transaction = {
        get: async (ref: Ref) => {
          if (writes.length) throw new Error("Firestore transactions require reads before writes.");
          return snapshot(this.documents.get(ref.path));
        },
        create: (ref: Ref, data: unknown) => {
          if (this.documents.has(ref.path)) throw new Error("Document already exists.");
          writes.push(() => { this.documents.set(ref.path, structuredClone(data)); });
        },
        set: (ref: Ref, data: unknown) => { writes.push(() => { this.documents.set(ref.path, structuredClone(data)); }); },
        update: (ref: Ref, data: Record<string, unknown>) => {
          const old = this.documents.get(ref.path);
          if (typeof old !== "object" || old === null) throw new Error("Document missing.");
          writes.push(() => { this.documents.set(ref.path, { ...old, ...structuredClone(data) }); });
        },
        delete: (ref: Ref) => { writes.push(() => { this.documents.delete(ref.path); }); },
      };
      const value = await run(transaction);
      for (const write of writes) write();
      return value;
    });
    this.tail = operation.then(() => undefined, () => undefined);
    return operation;
  }
}
