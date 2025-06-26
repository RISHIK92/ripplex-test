import { ripple } from "../lib/core/ripple";

describe("ripple()", () => {
  it("should create a primitive ripple for numbers", () => {
    const r = ripple(100);
    expect(r.value).toBe(100);

    r.value = 200;
    expect(r.value).toBe(200);
  });

  it("should create an object ripple for plain objects", () => {
    const r = ripple({ user: { name: "Rishi" } });
    expect(r.value.user.name).toBe("Rishi");

    r.value.user.name = "Rahul";
    expect(r.value.user.name).toBe("Rahul");
  });

  it("should support subscribe() for primitive", () => {
    const r = ripple(5);
    let notified = false;

    r.subscribe(() => {
      notified = true;
    });

    r.value = 10;
    expect(notified).toBe(true);
  });

  it("should support peek()", () => {
    const r = ripple({ x: 1 });
    expect(r.peek().x).toBe(1);
  });
});
