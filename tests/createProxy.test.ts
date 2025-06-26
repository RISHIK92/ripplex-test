import { createProxy } from "../lib/core/ripple";

describe("createProxy auto-wrap", () => {
  it("should notify on top-level property change", () => {
    const target = { name: "Rishik" };
    let notified = false;

    const proxy = createProxy(target, () => {
      notified = true;
    });

    proxy.name = "Rahul";

    expect(notified).toBe(true);
  });

  it("should notify on nested property change after assignment", () => {
    const state = {} as any;

    let notifyCount = 0;
    const proxy = createProxy(state, () => {
      notifyCount++;
    });

    proxy.user = { name: "Rishik" };

    proxy.user.name = "Rahul";
    expect(notifyCount).toBe(2);
  });

  it("should not notify if assigned value is same as existing", () => {
    const state = { count: 1 };
    let called = 0;

    const proxy = createProxy(state, () => {
      called++;
    });

    proxy.count = 1;
    expect(called).toBe(0);
  });

  it("should notify on delete", () => {
    const obj: { foo?: Number } = { foo: 123 };
    let deleted = false;

    const proxy = createProxy(obj, () => {
      deleted = true;
    });

    delete proxy.foo;
    expect(deleted).toBe(true);
  });

  it("should proxy deeply nested objects", () => {
    const obj = { settings: { theme: { dark: true } } };
    let called = false;

    const proxy = createProxy(obj, () => {
      called = true;
    });

    proxy.settings.theme.dark = false;
    expect(called).toBe(true);
  });
});
