import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { GuidedRoundCreate } from "@/components/sealed-bid/guided-round-create";

const { createSealedBidRoundMock } = vi.hoisted(() => ({
  createSealedBidRoundMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    createSealedBidRound: createSealedBidRoundMock,
  },
}));

describe("GuidedRoundCreate", () => {
  beforeEach(() => {
    createSealedBidRoundMock.mockReset();
    createSealedBidRoundMock.mockResolvedValue({
      success: true,
      data: { roundId: "round-1" },
    });
  });

  it("requires a selection description before continuing", () => {
    render(<GuidedRoundCreate onCreated={() => {}} onCancel={() => {}} />);

    expect(
      screen.getByRole("heading", { name: "What are you selecting?" }),
    ).toBeTruthy();

    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Selection description"), {
      target: { value: "Q3 security audit RFP" },
    });
    expect(continueButton).toHaveProperty("disabled", false);
  });

  it("does not let Enter bypass the guardrail and review steps", () => {
    render(<GuidedRoundCreate onCreated={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText("Selection description"), {
      target: { value: "Security audit RFP" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Guided round creation" }));

    expect(createSealedBidRoundMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "What are you selecting?" })).toBeTruthy();
  });

  it("walks through guardrails and review with explicit privacy and settlement copy", () => {
    render(<GuidedRoundCreate onCreated={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText("Selection description"), {
      target: { value: "Security audit RFP" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      screen.getByRole("heading", { name: "Set the round guardrails" }),
    ).toBeTruthy();
    expect(screen.getByText("Competitor privacy")).toBeTruthy();
    expect(screen.getByText("No funds reserved")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      screen.getByRole("heading", { name: "Review before creating" }),
    ).toBeTruthy();
    expect(screen.getByText("Security audit RFP")).toBeTruthy();
    // Environment context stays visible at the consequential moment.
    expect(screen.getByText("Demo workspace")).toBeTruthy();
    expect(screen.getByText(/no real funds can move/i)).toBeTruthy();
  });

  it("creates the round on submit and reports onCreated", async () => {
    const onCreated = vi.fn();
    render(
      <GuidedRoundCreate onCreated={onCreated} onCancel={() => {}} />,
    );

    fireEvent.change(screen.getByLabelText("Selection description"), {
      target: { value: "Security audit RFP" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /create round/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("round-1"));
    expect(createSealedBidRoundMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Security audit RFP",
        maxBids: 5,
        backend: "canton",
      }),
    );
  });

  it("cancels cleanly from the first step", () => {
    const onCancel = vi.fn();
    render(
      <GuidedRoundCreate onCreated={() => {}} onCancel={onCancel} />,
    );

    // Exact name: the header close button is labelled "Cancel round
    // creation", the footer button is the step-level cancel.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});