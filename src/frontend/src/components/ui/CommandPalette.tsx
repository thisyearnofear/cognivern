import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../stores/appStore";
import { useIntentStore, GeneratedUIComponent } from "../../stores/intentStore";
import Modal from "./Modal";
import GenerativeReveal from "./GenerativeReveal";
import StatCard from "./StatCard";
import AgentCard from "./AgentCard";
import PolicyCard from "./PolicyCard";
import GovernanceScore from "./GovernanceScore";
import ForensicTimeline from "./ForensicTimeline";
import Form from "./Form";
import { commandPaletteStyles } from "../../styles/design-system";

interface Command {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  action: () => void;
  keywords: string[];
  category: "navigation" | "actions" | "settings" | "help";
}

export const CommandPalette: React.FC = () => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { updatePreferences, preferences, setError } = useAppStore();
  const {
    isOpen,
    setIsOpen,
    submitIntent,
    isThinking,
    activeComponent,
    clearActiveIntent,
    clearHistory,
    suggestions,
    history,
  } = useIntentStore();

  const onClose = useCallback(() => setIsOpen(false), [setIsOpen]);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = useMemo(
    () => [
      // Navigation
      {
        id: "nav-dashboard",
        title: "Go to Dashboard",
        description: "View overview and metrics",
        icon: "📊",
        action: () => {
          navigate("/");
          onClose();
        },
        keywords: ["dashboard", "home", "overview", "metrics"],
        category: "navigation",
      },
      {
        id: "nav-trading",
        title: "Go to Trading",
        description: "Manage AI trading agents",
        icon: "🤖",
        action: () => {
          navigate("/trading");
          onClose();
        },
        keywords: ["trading", "agents", "ai", "bot"],
        category: "navigation",
      },
      {
        id: "nav-policies",
        title: "Go to Policies",
        description: "Manage governance policies",
        icon: "📋",
        action: () => {
          navigate("/policies");
          onClose();
        },
        keywords: ["policies", "governance", "rules", "compliance"],
        category: "navigation",
      },
      {
        id: "nav-audit",
        title: "Go to Audit Logs",
        description: "View activity history",
        icon: "📝",
        action: () => {
          navigate("/audit");
          onClose();
        },
        keywords: ["audit", "logs", "history", "activity"],
        category: "navigation",
      },

      // Actions
      {
        id: "action-new-policy",
        title: "Create New Policy",
        description: "Create a new governance policy",
        icon: "➕",
        action: () => {
          navigate("/policies");
          // TODO: Trigger new policy creation
          onClose();
        },
        keywords: ["create", "new", "policy", "add"],
        category: "actions",
      },
      {
        id: "action-start-agent",
        title: "Start Trading Agent",
        description: "Start an AI trading agent",
        icon: "▶️",
        action: () => {
          navigate("/trading");
          // TODO: Trigger agent start
          onClose();
        },
        keywords: ["start", "agent", "trading", "run"],
        category: "actions",
      },

      // Settings
      {
        id: "setting-toggle-theme",
        title: "Toggle Theme",
        description: `Switch to ${preferences.theme === "dark" ? "light" : "dark"} mode`,
        icon: preferences.theme === "dark" ? "☀️" : "🌙",
        action: () => {
          updatePreferences({
            theme: preferences.theme === "dark" ? "light" : "dark",
          });
          onClose();
        },
        keywords: ["theme", "dark", "light", "mode"],
        category: "settings",
      },
      {
        id: "setting-toggle-sidebar",
        title: "Toggle Sidebar",
        description: preferences.sidebarCollapsed
          ? "Expand sidebar"
          : "Collapse sidebar",
        icon: preferences.sidebarCollapsed ? "→" : "←",
        action: () => {
          updatePreferences({
            sidebarCollapsed: !preferences.sidebarCollapsed,
          });
          onClose();
        },
        keywords: ["sidebar", "collapse", "expand", "toggle"],
        category: "settings",
      },

      // Help
      {
        id: "help-shortcuts",
        title: "Keyboard Shortcuts",
        description: "View available keyboard shortcuts",
        icon: "⌨️",
        action: () => {
          // TODO: Show shortcuts help
          setError("Keyboard shortcuts help coming soon!");
          onClose();
        },
        keywords: ["shortcuts", "keyboard", "help", "hotkeys"],
        category: "help",
      },
      {
        id: "help-docs",
        title: "Documentation",
        description: "View platform documentation",
        icon: "📚",
        action: () => {
          window.open("https://github.com/your-repo/docs", "_blank");
          onClose();
        },
        keywords: ["docs", "documentation", "help", "guide"],
        category: "help",
      },
    ],
    [navigate, onClose, updatePreferences, preferences, setError],
  );

  // Filter commands based on query
  const filteredCommands = commands.filter((command) => {
    if (!query) return true;

    const searchText = query.toLowerCase();
    return (
      command.title.toLowerCase().includes(searchText) ||
      command.description?.toLowerCase().includes(searchText) ||
      command.keywords.some((keyword) =>
        keyword.toLowerCase().includes(searchText),
      )
    );
  });

  // Group commands by category
  const groupedCommands = filteredCommands.reduce(
    (acc, command) => {
      if (!acc[command.category]) {
        acc[command.category] = [];
      }
      acc[command.category].push(command);
      return acc;
    },
    {} as Record<string, Command[]>,
  );

  // Reset selection when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1,
          );
          break;
        case "Enter":
          event.preventDefault();
          // If the query matches a specific static command exactly or is selected, run it
          // Otherwise, treat it as a general agentic intent
          if (
            query &&
            filteredCommands.length > 0 &&
            selectedIndex < filteredCommands.length
          ) {
            filteredCommands[selectedIndex].action();
          } else if (query) {
            submitIntent(query);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands]);

  const categoryLabels = {
    navigation: "Navigation",
    actions: "Actions",
    settings: "Settings",
    help: "Help",
  };

  let commandIndex = 0;

  // Simple Generative UI Renderer
  const renderGenerativeUI = (component: GeneratedUIComponent) => {
    switch (component.type) {
      case "stat":
        return (
          <div style={{ padding: "10px" }}>
            <StatCard
              label={component.props.title || component.props.label}
              value={component.props.value}
              icon={component.props.icon || "📊"}
              color={component.props.color || "primary"}
              trend={component.props.trend}
            />
          </div>
        );
      case "agent":
        return (
          <div style={{ padding: "10px" }}>
            <AgentCard agent={component.data || (component.props as any)} />
          </div>
        );
      case "action-form":
        return (
          <div style={{ padding: "15px" }}>
            <div
              style={{
                marginBottom: "15px",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              {component.props.title}
            </div>
            <Form
              fields={component.props.fields}
              submitText={component.props.submitText}
              onSubmit={(data) => {
                console.log("Form submitted via Intent:", data);
                setError(`Agent action initiated: ${component.props.title}`);
                clearActiveIntent();
              }}
            />
          </div>
        );
      case "status":
        return (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              animation: "fadeIn 0.5s ease-out",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background:
                  component.props.status === "success" ? "#dcfce7" : "#fee2e2",
                color:
                  component.props.status === "success" ? "#166534" : "#991b1b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 15px",
                fontSize: "24px",
              }}
            >
              {component.props.status === "success" ? "✓" : "!"}
            </div>
            <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
              {component.props.title}
            </div>
            <div style={{ fontSize: "14px", opacity: 0.7 }}>
              {component.props.message}
            </div>
          </div>
        );
      case "policy":
        return (
          <div style={{ padding: "10px" }}>
            <PolicyCard policy={component.data || (component.props as any)} />
          </div>
        );
      case "governance-score":
        return (
          <div style={{ padding: "10px" }}>
            <GovernanceScore
              score={component.props.score}
              label={component.props.label}
              details={component.props.details}
            />
          </div>
        );
      case "forensic-timeline":
        return (
          <div style={{ padding: "10px" }}>
            <ForensicTimeline
              events={component.props.events}
              agentName={component.props.agentName}
            />
          </div>
        );
      case "markdown":
        return <div style={{ padding: "15px" }}>{component.props.content}</div>;
      default:
        return (
          <div style={{ padding: "15px", opacity: 0.5 }}>
            Generated view: {component.type}
          </div>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      showCloseButton={false}
      closeOnOverlayClick={true}
      closeOnEscape={true}
    >
      <div>
        {/* Search Input */}
        <div css={commandPaletteInputContainerStyles}>
          <input
            ref={inputRef}
            type="text"
            placeholder={
              isThinking
                ? "Agent is thinking..."
                : "Ask anything or type a command..."
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (activeComponent) clearActiveIntent();
            }}
            disabled={isThinking}
            css={commandPaletteInputStyles}
          />
          {isThinking && (
            <div
              style={{
                position: "absolute",
                right: "15px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                border: "2px solid transparent",
                borderTopColor: "#3b82f6",
                animation: "spin 1s linear infinite",
              }}
            />
          )}
        </div>

        {/* Dynamic Content Area */}
        <div css={commandPaletteListStyles}>
          {activeComponent ? (
            <GenerativeReveal duration={800}>
              <div css={commandPaletteCategoryStyles}>Agent Response</div>
              {renderGenerativeUI(activeComponent)}
              <div style={{ padding: "10px", textAlign: "right" }}>
                <button
                  onClick={clearActiveIntent}
                  style={{
                    fontSize: "11px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    opacity: 0.5,
                  }}
                >
                  Clear Result
                </button>
              </div>
            </GenerativeReveal>
          ) : isThinking ? (
            <div css={commandPaletteNoResultsStyles}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  background: "linear-gradient(45deg, #3b82f6, #8b5cf6)",
                  borderRadius: "12px",
                  margin: "0 auto 15px",
                  filter: "blur(8px)",
                  animation: "pulse 2s infinite",
                }}
              />
              <div>Processing Intent...</div>
            </div>
          ) : (
            <>
              {/* Proactive Suggestions */}
              {!query && suggestions.length > 0 && (
                <div>
                  <div css={commandPaletteCategoryStyles}>
                    ✨ Recommended for you
                  </div>
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      css={getCommandPaletteItemStyles(false)}
                      onClick={() => submitIntent(suggestion.intent)}
                    >
                      <span css={commandPaletteIconStyles}>
                        {suggestion.icon || "💡"}
                      </span>
                      <div css={commandPaletteTextStyles}>
                        <div css={commandPaletteTitleStyles}>
                          {suggestion.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent Activity */}
              {!query && history.length > 0 && (
                <div>
                  <div css={commandPaletteCategoryStyles}>🕒 Recent</div>
                  {history.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      css={getCommandPaletteItemStyles(false)}
                      onClick={() => submitIntent(item.query)}
                    >
                      <span css={commandPaletteIconStyles}>↩️</span>
                      <div css={commandPaletteTextStyles}>
                        <div css={commandPaletteTitleStyles}>{item.query}</div>
                        <div css={commandPaletteDescriptionStyles}>
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {Object.entries(groupedCommands).map(
                ([category, categoryCommands]) => (
                  <div key={category}>
                    <div css={commandPaletteCategoryStyles}>
                      {categoryLabels[category as keyof typeof categoryLabels]}
                    </div>
                    {categoryCommands.map((command) => {
                      const isSelected = commandIndex === selectedIndex;
                      const currentIndex = commandIndex++;

                      return (
                        <div
                          key={command.id}
                          css={commandPaletteStyles.item(isSelected)}
                          onClick={() => command.action()}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                        >
                          <span css={commandPaletteStyles.icon}>
                            {command.icon}
                          </span>
                          <div css={commandPaletteStyles.text}>
                            <div css={commandPaletteStyles.title}>
                              {command.title}
                            </div>
                            {command.description && (
                              <div css={commandPaletteStyles.description}>
                                {command.description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ),
              )}

              {query && filteredCommands.length === 0 && (
                <div css={commandPaletteNoResultsStyles}>
                  <div>✨</div>
                  <div>Press Enter to ask the Agent</div>
                  <div style={{ fontSize: "11px", opacity: 0.6 }}>
                    "{query}"
                  </div>
                </div>
              )}

              {!query && filteredCommands.length === 0 && (
                <div css={commandPaletteNoResultsStyles}>
                  <div>🔍</div>
                  <div>No commands found</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div css={commandPaletteFooterStyles}>
          {isThinking ? (
            <span>Analyzing natural language intent...</span>
          ) : activeComponent ? (
            <>
              <span>Result generated by Cognivern Agent</span>
              <button
                onClick={clearActiveIntent}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "10px",
                  cursor: "pointer",
                  opacity: 0.5,
                  textDecoration: "underline",
                }}
              >
                Clear Result
              </button>
            </>
          ) : (
            <>
              <span>Use ↑↓ to navigate, ↵ to select or submit intent</span>
              <div
                style={{ display: "flex", gap: "12px", alignItems: "center" }}
              >
                <span>{filteredCommands.length} shortcuts available</span>
                {history.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearHistory();
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "10px",
                      cursor: "pointer",
                      opacity: 0.5,
                      textDecoration: "underline",
                    }}
                  >
                    Clear History & Context
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CommandPalette;
