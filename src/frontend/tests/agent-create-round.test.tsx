import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentCreateRound } from "@/components/sealed-bid/agent-create-round";

const { createSealedBidRoundMock, mutateMock } = vi.hoisted(() => ({
  createSealedBidRoundMock: vi.fn(),
  mutateMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    createSealedBidRound: createSealedBidRoundMock,
  },
}));

vi.mock("@/hooks/use-api", () => ({
  useAgents: () => ({
    data: [
      {
        id: "agent-1",
        name: "Agent One",
        role: "Treasury",
        status: "active",
        source: "managed",
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-workspace-mode", () => ({
  useWorkspaceMode: () => ({
    mode: "production",
    isConnected: true,
  }),
}));

vi.mock("swr", () => ({ mutate: mutateMock }));

describe("AgentCreateRound", () => {
  beforeEach(() => {
    createSealedBidRoundMock.mockReset();
    createSealedBidRoundMock.mockResolvedValue({
      success: true,
      data: { roundId: "round-1" },
    });
    mutateMock.mockResolvedValue(undefined);
  });

  it("requires explicit acknowledgement before reserving production value", async () => {
    const onCreated = vi.fn();
    render(<AgentCreateRound onCreated={onCreated} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /Agent One/ }));
    fireEvent.change(screen.getByLabelText("RFP description"), {
      target: { value: "Security audit RFP" },
    });

    fireEvent.submit(screen.getByRole("form", { name: "Agent round creation" }));

    expect(createSealedBidRoundMock).not.toHaveBeenCalled();
    expect(screen.getByText("Confirm production settlement")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /create and reserve value/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("round-1"));
    expect(createSealedBidRoundMock).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "agent-1",
        settlementAmount: 50000,
        settlementAssetTag: "USDC",
      }),
    );
  });
});
