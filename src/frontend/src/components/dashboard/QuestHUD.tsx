/**
 * QuestHUD - Displays governance quests and alerts
 * Extracted from UnifiedDashboard for better modularity
 */

import { ShieldCheck, AlertTriangle, Search, Info } from "lucide-react";
import { designTokens } from "../../styles/design-system";
import { Card, CardContent, Button } from "../ui";
import { QuestItem } from "./utils/types";
import { mapQuestSeverity } from "./utils/activity";
import * as styles from "./UnifiedDashboard.styles";

interface QuestHUDProps {
  quests: QuestItem[];
  onResolve: (id: string) => void;
}

export const QuestHUD = ({ quests, onResolve }: QuestHUDProps) => {
  if (quests.length === 0) {
    return (
      <Card>
        <CardContent css={styles.emptyStateStyles}>
          <ShieldCheck size={48} opacity={0.3} />
          <div>All governance systems compliant.</div>
        </CardContent>
      </Card>
    );
  }

  const getQuestIcon = (type: string) => {
    switch (type) {
      case "alert":
        return <AlertTriangle size={20} />;
      case "pattern":
        return <Search size={20} />;
      case "recommendation":
        return <Info size={20} />;
      default:
        return <ShieldCheck size={20} />;
    }
  };

  return (
    <Card>
      <CardContent css={styles.activityFeedStyles(true)}>
        {quests.map((quest) => (
          <div key={quest.id} css={styles.activityItemStyles}>
            <div
              css={styles.activityIconStyles(mapQuestSeverity(quest.severity))}
            >
              {getQuestIcon(quest.type)}
            </div>
            <div css={styles.activityDetailsStyles} style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div css={styles.activityTextStyles}>{quest.title}</div>
                {quest.actionRequired && (
                  <div
                    css={styles.systemBadgeStyles(
                      mapQuestSeverity(quest.severity),
                    )}
                  >
                    ACTION REQUIRED
                  </div>
                )}
              </div>
              <div css={styles.activityTimeStyles}>{quest.description}</div>
              {quest.actionRequired && (
                <div
                  style={{
                    marginTop: designTokens.spacing[2],
                    display: "flex",
                    gap: designTokens.spacing[2],
                  }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    style={{
                      fontSize: "10px",
                      padding: "2px 8px",
                      height: "auto",
                    }}
                    onClick={() => onResolve(quest.id)}
                  >
                    Resolve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    style={{
                      fontSize: "10px",
                      padding: "2px 8px",
                      height: "auto",
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default QuestHUD;
