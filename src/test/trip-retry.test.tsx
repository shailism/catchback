import { beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { getAllTrips } from "@/lib/db";

const navigation = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@tanstack/react-router", async importOriginal => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigation, useLocation: () => ({ state: undefined }), Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> };
});
import { Route, TripDetail } from "@/routes/trips.$id";

beforeEach(() => {
  cleanup(); vi.restoreAllMocks(); navigation.mockReset(); navigation.mockResolvedValue(undefined);
  vi.stubGlobal("indexedDB", new IDBFactory());
  Object.defineProperty(navigator, "storage", { configurable: true, value: { persisted: async () => true } });
});
function fillNew() {
  fireEvent.change(screen.getByLabelText("Trip date"), { target: { value: "2025-10-12" } });
  fireEvent.click(screen.getByLabelText("No catches"));
}
it("a committed but unconfirmed write retries under the same ID and timestamp, producing one trip", async () => {
  vi.spyOn(Route, "useParams").mockReturnValue({ id: "new" });
  const get = IDBObjectStore.prototype.get;
  let failReadback = true;
  vi.spyOn(IDBObjectStore.prototype, "get").mockImplementation(function (this: IDBObjectStore, key) {
    const request = get.call(this, key);
    if (this.name === "trips" && failReadback) {
      failReadback = false;
      request.addEventListener("success", () => { Object.defineProperty(request, "result", { value: undefined, writable: true, configurable: true }); });
    }
    return request;
  });
  render(<TripDetail />); await screen.findByLabelText("Trip date"); fillNew();
  fireEvent.click(screen.getByRole("button", { name: "Save trip" }));
  await screen.findByRole("alert");
  const first = await getAllTrips(); expect(first).toHaveLength(1); expect(navigation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save trip" }));
  await waitFor(() => expect(navigation).toHaveBeenCalledOnce());
  const final = await getAllTrips(); expect(final).toHaveLength(1);
  expect(final[0]?.id).toBe(first[0]?.id); expect(final[0]?.createdAt).toBe(first[0]?.createdAt);
});
it("navigation failure also retains identity, while opening another route then a new draft resets it", async () => {
  let id = "new";
  vi.spyOn(Route, "useParams").mockImplementation(() => ({ id }));
  navigation.mockRejectedValueOnce(new Error("Disposable navigation failure"));
  const view = render(<TripDetail />); await screen.findByLabelText("Trip date"); fillNew();
  fireEvent.click(screen.getByRole("button", { name: "Save trip" })); await screen.findByRole("alert");
  const first = (await getAllTrips())[0]; if (!first) throw new Error("Missing fixture");
  fireEvent.click(screen.getByRole("button", { name: "Save trip" })); await waitFor(() => expect(navigation).toHaveBeenCalledTimes(2));
  expect(await getAllTrips()).toEqual([first]);
  id = first.id; view.rerender(<TripDetail />); await screen.findByLabelText("Trip date");
  fireEvent.click(screen.getByLabelText("Caught fish")); fireEvent.click(screen.getByRole("button", { name: "Save trip" }));
  await waitFor(async () => expect((await getAllTrips())[0]?.outcome).toBe("caught"));
  expect((await getAllTrips())[0]?.id).toBe(first.id); expect((await getAllTrips())[0]?.createdAt).toBe(first.createdAt);
  id = "new"; view.rerender(<TripDetail />); await screen.findByLabelText("Trip date");
  expect(screen.getByLabelText("Trip date")).toHaveValue(""); fillNew();
  fireEvent.click(screen.getByRole("button", { name: "Save trip" }));
  await waitFor(async () => expect(await getAllTrips()).toHaveLength(2));
  expect((await getAllTrips()).filter(t => t.id !== first.id)).toHaveLength(1);
});