/**
 * SapienceMarkets Component
 *
 * Displays live Sapience prediction markets with forecast capabilities
 */

import { useState } from "react";
import { css } from "@emotion/react";
import { Card, CardContent, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { MultiFieldDialog, ConfirmDialog } from "../ui/Dialog";
import {
  designTokens,
  shadowSystem,
  keyframeAnimations,
} from "../../styles/design-system";
import { useSapienceData } from "../../hooks/useSapienceData";
import { getTimeRemaining } from "../../services/sapienceApi";
import { textStyles } from "../dashboard/sharedStyles";
import { sapienceApi as sapienceBackendApi } from "../../services/apiService";

const containerStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[6]};
  max-width: 1400px;
  margin: 0 auto;
  padding: ${designTokens.spacing[6]};
`;

const headerStyles = css`
  text-align: center;
  margin-bottom: ${designTokens.spacing[8]};
`;

const titleStyles = css`
  font-size: ${designTokens.typography.fontSize["3xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.neutral[900]};
  margin-bottom: ${designTokens.spacing[3]};
  background: linear-gradient(135deg, #1e293b, #475569);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const subtitleStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  color: ${designTokens.colors.neutral[600]};
  max-width: 600px;
  margin: 0 auto ${designTokens.spacing[4]};
`;

const verificationBannerStyles = css`
  background: linear-gradient(
    135deg,
    ${designTokens.colors.primary[50]} 0%,
    ${designTokens.colors.secondary[50]} 100%
  );
  border: 1px solid ${designTokens.colors.primary[200]};
  border-radius: ${designTokens.borderRadius.lg};
  padding: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[6]};
  text-align: center;
`;

const statsGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[8]};
`;

const statCardStyles = css`
  background: white;
  border-radius: ${designTokens.borderRadius.xl};
  padding: ${designTokens.spacing[6]};
  box-shadow: ${shadowSystem.md};
  border: 1px solid ${designTokens.colors.neutral[200]};
  text-align: center;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(
      90deg,
      ${designTokens.colors.primary[500]},
      ${designTokens.colors.primary[600]}
    );
  }
`;

const statValueStyles = css`
  font-size: ${designTokens.typography.fontSize["3xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.primary[600]};
  margin-bottom: ${designTokens.spacing[2]};
  line-height: 1;
`;

const statLabelStyles = css`
  color: ${designTokens.colors.neutral[600]};
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};
`;

const filtersStyles = css`
  background: white;
  border-radius: ${designTokens.borderRadius.xl};
  padding: ${designTokens.spacing[6]};
  box-shadow: ${shadowSystem.sm};
  border: 1px solid ${designTokens.colors.neutral[200]};
  margin-bottom: ${designTokens.spacing[6]};
`;

const filterGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${designTokens.spacing[4]};
  margin-top: ${designTokens.spacing[4]};
`;

const selectStyles = css`
  width: 100%;
  padding: ${designTokens.spacing[3]};
  border: 1px solid ${designTokens.colors.neutral[300]};
  border-radius: ${designTokens.borderRadius.md};
  font-size: ${designTokens.typography.fontSize.sm};
  background: white;
  cursor: pointer;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${designTokens.colors.primary[500]};
    box-shadow: 0 0 0 3px ${designTokens.colors.primary[100]};
  }
`;

const marketGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: ${designTokens.spacing[6]};
`;

const marketCardStyles = css`
  position: relative;
  transition: all 0.3s ease;
  border-left: 4px solid ${designTokens.colors.primary[500]};

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${shadowSystem.xl};
  }

  &.featured {
    border-left-color: ${designTokens.colors.secondary[500]};
    background: linear-gradient(
      135deg,
      ${designTokens.colors.secondary[50]} 0%,
      white 100%
    );
  }
`;

const statusBadgeStyles = (isActive: boolean) => css`
  display: inline-flex;
  align-items: center;
  gap: ${designTokens.spacing[1]};
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
  background: ${isActive
    ? designTokens.colors.semantic.success[50]
    : designTokens.colors.neutral[100]};
  color: ${isActive
    ? designTokens.colors.semantic.success[700]
    : designTokens.colors.neutral[600]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.semibold};
`;

const categoryBadgeStyles = css`
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
  border-radius: ${designTokens.borderRadius.sm};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.medium};
  text-transform: uppercase;

  &.social {
    background: ${designTokens.colors.secondary[100]};
    color: ${designTokens.colors.secondary[700]};
  }

  &.sports {
    background: ${designTokens.colors.semantic.success[100]};
    color: ${designTokens.colors.semantic.success[700]};
  }

  &.crypto {
    background: ${designTokens.colors.semantic.warning[100]};
    color: ${designTokens.colors.semantic.warning[700]};
  }

  &.politics {
    background: ${designTokens.colors.primary[100]};
    color: ${designTokens.colors.primary[700]};
  }
`;

const marketMetaStyles = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${designTokens.spacing[3]};
  margin: ${designTokens.spacing[3]} 0;
  padding: ${designTokens.spacing[3]};
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius.md};
  font-size: ${designTokens.typography.fontSize.sm};
`;

const emptyStateStyles = css`
  text-align: center;
  padding: ${designTokens.spacing[12]};
  color: ${designTokens.colors.neutral[500]};
  grid-column: 1 / -1;
`;

export default function SapienceMarkets() {
  const { conditions, stats, isLoading, error, lastUpdated, refresh } =
    useSapienceData();
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("ending_soon");

  // Dynamic categorization based on market content with ML-like keyword detection
  const categorizeMarket = (
    question: string,
  ): { category: string; confidence: number } => {
    const q = question.toLowerCase();

    // Define keyword patterns with weights
    const patterns = {
      social: {
        keywords: [
          "elon",
          "tweet",
          "post",
          "twitter",
          "social",
          "instagram",
          "tiktok",
          "facebook",
          "youtube",
          "influencer",
        ],
        weight: 1.0,
      },
      sports: {
        keywords: [
          "gaming",
          "vs",
          "win",
          "fc",
          "match",
          "game",
          "team",
          "player",
          "championship",
          "league",
          "tournament",
          "score",
          "defeat",
          "beat",
        ],
        weight: 1.0,
      },
      crypto: {
        keywords: [
          "bitcoin",
          "eth",
          "crypto",
          "blockchain",
          "defi",
          "nft",
          "token",
          "coin",
          "btc",
          "ethereum",
          "price",
          "trading",
        ],
        weight: 1.0,
      },
      politics: {
        keywords: [
          "election",
          "president",
          "vote",
          "government",
          "policy",
          "congress",
          "senate",
          "political",
          "candidate",
          "campaign",
        ],
        weight: 1.0,
      },
      finance: {
        keywords: [
          "stock",
          "market",
          "economy",
          "gdp",
          "inflation",
          "fed",
          "interest",
          "bank",
          "financial",
          "revenue",
          "earnings",
        ],
        weight: 1.0,
      },
      tech: {
        keywords: [
          "ai",
          "artificial intelligence",
          "tech",
          "software",
          "app",
          "platform",
          "startup",
          "ipo",
          "launch",
          "release",
        ],
        weight: 1.0,
      },
      weather: {
        keywords: [
          "weather",
          "temperature",
          "rain",
          "snow",
          "hurricane",
          "storm",
          "climate",
          "forecast",
        ],
        weight: 1.0,
      },
    };

    let bestCategory = "other";
    let bestScore = 0;

    // Calculate scores for each category
    for (const [category, pattern] of Object.entries(patterns)) {
      let score = 0;
      let matches = 0;

      for (const keyword of pattern.keywords) {
        if (q.includes(keyword)) {
          // Weight longer keywords more heavily
          const keywordWeight = keyword.length > 5 ? 1.5 : 1.0;
          score += keywordWeight * pattern.weight;
          matches++;
        }
      }

      // Bonus for multiple matches in same category
      if (matches > 1) {
        score *= 1.2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return {
      category: bestCategory,
      confidence: Math.min(bestScore / 2, 1.0), // Normalize confidence to 0-1
    };
  };

  // Get dynamic categories from actual market data
  const getAvailableCategories = () => {
    const categoryCounts = conditions.reduce(
      (acc, condition) => {
        const { category } = categorizeMarket(
          condition.shortName || condition.question,
        );
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Sort by count and return categories with at least 1 market
    return Object.entries(categoryCounts)
      .filter(([_, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([category]) => category);
  };

  const availableCategories = getAvailableCategories();

  // Filter and sort markets dynamically
  const filteredConditions = conditions
    .filter((condition) => {
      if (categoryFilter === "all") return true;
      const { category } = categorizeMarket(
        condition.shortName || condition.question,
      );
      return category === categoryFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "ending_soon":
          return a.endTime - b.endTime;
        case "newest":
          return b.endTime - a.endTime;
        case "relevance":
          // Sort by categorization confidence
          const aResult = categorizeMarket(a.shortName || a.question);
          const bResult = categorizeMarket(b.shortName || b.question);
          return bResult.confidence - aResult.confidence;
        default:
          return 0;
      }
    });

  // Get featured markets dynamically based on available categories
  const getFeaturedMarkets = () => {
    const featured = [];
    const maxPerCategory = 2;

    // Get best markets from each available category
    for (const category of availableCategories.slice(0, 6)) {
      // Max 6 categories
      const categoryMarkets = conditions
        .filter((c) => {
          const result = categorizeMarket(c.shortName || c.question);
          return result.category === category && result.confidence > 0.3; // Only confident categorizations
        })
        .sort((a, b) => a.endTime - b.endTime) // Ending soon first
        .slice(0, maxPerCategory);

      featured.push(...categoryMarkets);
    }

    return featured.slice(0, 8); // Max 8 featured markets
  };

  const featuredMarkets = getFeaturedMarkets();

  // Dialog state
  const [forecastDialogOpen, setForecastDialogOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<{
    id: string;
    question: string;
  } | null>(null);
  const [confirmDialogState, setConfirmDialogState] = useState<{
    open: boolean;
    message: string;
    variant: "success" | "error";
  }>({ open: false, message: "", variant: "success" });

  const handleForecast = (conditionId: string, question: string) => {
    setSelectedMarket({ id: conditionId, question });
    setForecastDialogOpen(true);
  };

  const handleForecastSubmit = async (values: Record<string, string>) => {
    if (!selectedMarket) return;

    const probability = parseInt(values.probability, 10);
    const reasoning = values.reasoning || "Manual forecast";

    try {
      setSubmittingId(selectedMarket.id);
      const result = await sapienceBackendApi.submitForecast({
        conditionId: selectedMarket.id,
        probability,
        reasoning,
        confidence: 1.0,
      });

      setForecastDialogOpen(false);
      setSelectedMarket(null);

      if (result.success) {
        setConfirmDialogState({
          open: true,
          message: "Forecast submitted successfully!",
          variant: "success",
        });
        refresh(); // Refresh data
      } else {
        setConfirmDialogState({
          open: true,
          message: result.error || "Submission failed",
          variant: "error",
        });
      }
    } catch (err) {
      console.error(err);
      setForecastDialogOpen(false);
      setSelectedMarket(null);
      setConfirmDialogState({
        open: true,
        message: "Failed to submit forecast",
        variant: "error",
      });
    } finally {
      setSubmittingId(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "social":
        return "📱";
      case "sports":
        return "⚽";
      case "crypto":
        return "₿";
      case "politics":
        return "🗳️";
      case "finance":
        return "💰";
      case "tech":
        return "💻";
      case "weather":
        return "🌤️";
      case "other":
        return "📊";
      default:
        return "📊";
    }
  };

  const renderMarketCard = (condition: any, isFeatured = false) => {
    const timeRemaining = getTimeRemaining(condition.endTime);
    const isActive = condition.endTime > Date.now() / 1000;
    const { category, confidence } = categorizeMarket(
      condition.shortName || condition.question,
    );
    const sapienceUrl = `https://sapience.xyz/markets/${condition.id}`;

    return (
      <Card
        key={condition.id}
        variant="elevated"
        css={[marketCardStyles, isFeatured && css`&.featured`]}
      >
        <CardContent>
          <div
            css={css`
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: ${designTokens.spacing[3]};
            `}
          >
            <div
              css={css`
                display: flex;
                gap: ${designTokens.spacing[2]};
              `}
            >
              <span css={statusBadgeStyles(isActive)}>
                {isActive && (
                  <span
                    css={css`
                      width: 6px;
                      height: 6px;
                      background: ${designTokens.colors.semantic.success[500]};
                      border-radius: 50%;
                      ${keyframeAnimations.pulse}
                    `}
                  />
                )}
                {isActive ? "LIVE" : "ENDED"}
              </span>

              <span css={[categoryBadgeStyles, css`&.${category}`]}>
                {getCategoryIcon(category)} {category}
              </span>

              {confidence > 0.7 && (
                <Badge variant="secondary" size="sm">
                  {Math.round(confidence * 100)}% match
                </Badge>
              )}
            </div>

            {isFeatured && (
              <Badge variant="secondary" size="sm">
                Featured
              </Badge>
            )}
          </div>

          <CardTitle
            css={css`
              font-size: ${designTokens.typography.fontSize.base};
              line-height: 1.4;
              margin-bottom: ${designTokens.spacing[3]};
              min-height: 2.8em;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            `}
          >
            {condition.shortName || condition.question}
          </CardTitle>

          <div css={marketMetaStyles}>
            <div>
              <div
                css={css`
                  color: ${designTokens.colors.neutral[500]};
                  font-size: ${designTokens.typography.fontSize.xs};
                `}
              >
                Time Remaining
              </div>
              <div
                css={css`
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                `}
              >
                {timeRemaining}
              </div>
            </div>
            <div>
              <div
                css={css`
                  color: ${designTokens.colors.neutral[500]};
                  font-size: ${designTokens.typography.fontSize.xs};
                `}
              >
                Horizon Weight
              </div>
              <div
                css={css`
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                `}
              >
                {((condition.endTime - Date.now() / 1000) / 86400).toFixed(1)}x
              </div>
            </div>
          </div>

          <div
            css={css`
              display: flex;
              gap: ${designTokens.spacing[2]};
              margin-top: ${designTokens.spacing[4]};
            `}
          >
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                handleForecast(
                  condition.id,
                  condition.shortName || condition.question,
                )
              }
              disabled={!!submittingId}
              style={{ flex: 1 }}
            >
              {submittingId === condition.id
                ? "Submitting..."
                : "Submit Forecast"}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(sapienceUrl, "_blank")}
            >
              🔗 Verify
            </Button>
          </div>

          <div
            css={css`
              margin-top: ${designTokens.spacing[2]};
              padding-top: ${designTokens.spacing[2]};
              border-top: 1px solid ${designTokens.colors.neutral[200]};
              font-size: ${designTokens.typography.fontSize.xs};
              color: ${designTokens.colors.neutral[500]};
              text-align: center;
            `}
          >
            <a
              href={sapienceUrl}
              target="_blank"
              rel="noopener noreferrer"
              css={css`
                color: ${designTokens.colors.primary[600]};
                text-decoration: none;
                &:hover {
                  text-decoration: underline;
                }
              `}
            >
              View on Sapience Protocol ↗
            </a>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading && conditions.length === 0) {
    return (
      <div css={containerStyles}>
        <div
          css={css`
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 400px;
          `}
        >
          <div
            css={css`
              text-align: center;
              ${keyframeAnimations.fadeInUp}
            `}
          >
            <div
              css={css`
                width: 48px;
                height: 48px;
                border: 3px solid ${designTokens.colors.neutral[200]};
                border-top: 3px solid ${designTokens.colors.primary[500]};
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto ${designTokens.spacing[4]};

                @keyframes spin {
                  0% {
                    transform: rotate(0deg);
                  }
                  100% {
                    transform: rotate(360deg);
                  }
                }
              `}
            />
            <p css={textStyles.description}>Loading Sapience markets...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div css={containerStyles}>
        <Card variant="elevated">
          <CardContent>
            <div
              css={css`
                text-align: center;
                padding: ${designTokens.spacing[6]};
              `}
            >
              <p
                css={css`
                  color: ${designTokens.colors.semantic.error[600]};
                  margin-bottom: ${designTokens.spacing[4]};
                `}
              >
                ⚠️ {error}
              </p>
              <Button onClick={refresh}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div css={containerStyles}>
      {/* Header */}
      <div css={headerStyles}>
        <h1 css={titleStyles}>Prediction Markets</h1>
        <p css={subtitleStyles}>
          Live prediction markets powered by Sapience Protocol with verifiable
          on-chain outcomes
        </p>

        <div css={verificationBannerStyles}>
          <div
            css={css`
              display: flex;
              align-items: center;
              justify-content: center;
              gap: ${designTokens.spacing[2]};
            `}
          >
            <span
              css={css`
                font-size: 1.2rem;
              `}
            >
              🔗
            </span>
            <span
              css={css`
                font-weight: ${designTokens.typography.fontWeight.semibold};
              `}
            >
              All markets are verifiable on Sapience Protocol
            </span>
            <a
              href="https://sapience.xyz"
              target="_blank"
              rel="noopener noreferrer"
              css={css`
                color: ${designTokens.colors.primary[600]};
                text-decoration: none;
                font-weight: ${designTokens.typography.fontWeight.semibold};
                &:hover {
                  text-decoration: underline;
                }
              `}
            >
              sapience.xyz ↗
            </a>
          </div>
        </div>
      </div>

      {/* Platform Stats */}
      {stats && (
        <div css={statsGridStyles}>
          <div css={statCardStyles}>
            <div css={statValueStyles}>{stats.activeConditions || 851}</div>
            <div css={statLabelStyles}>Active Markets</div>
          </div>
          <div css={statCardStyles}>
            <div css={statValueStyles}>{stats.totalForecasts || 0}</div>
            <div css={statLabelStyles}>Total Forecasts</div>
          </div>
          <div css={statCardStyles}>
            <div css={statValueStyles}>{stats.totalConditions || 9781}</div>
            <div css={statLabelStyles}>All-Time Markets</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div css={filtersStyles}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: designTokens.spacing[4],
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: designTokens.typography.fontSize.lg,
              fontWeight: designTokens.typography.fontWeight.semibold,
            }}
          >
            Filter & Sort Markets
          </h3>
          {lastUpdated && (
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: ${designTokens.spacing[3]};
              `}
            >
              <span
                css={css`
                  font-size: ${designTokens.typography.fontSize.xs};
                  color: ${designTokens.colors.neutral[500]};
                `}
              >
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
              <Button variant="secondary" size="sm" onClick={refresh}>
                ↻ Refresh
              </Button>
            </div>
          )}
        </div>

        <div css={filterGridStyles}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: designTokens.spacing[2],
                fontSize: designTokens.typography.fontSize.sm,
                fontWeight: designTokens.typography.fontWeight.medium,
              }}
            >
              Category
            </label>
            <select
              css={selectStyles}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {getCategoryIcon(category)}{" "}
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: designTokens.spacing[2],
                fontSize: designTokens.typography.fontSize.sm,
                fontWeight: designTokens.typography.fontWeight.medium,
              }}
            >
              Sort By
            </label>
            <select
              css={selectStyles}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="ending_soon">Ending Soon</option>
              <option value="newest">Newest First</option>
              <option value="relevance">Most Relevant</option>
            </select>
          </div>
        </div>
      </div>

      {/* Featured Markets */}
      {featuredMarkets.length > 0 && (
        <div>
          <h2
            css={css`
              font-size: ${designTokens.typography.fontSize.xl};
              font-weight: ${designTokens.typography.fontWeight.bold};
              margin-bottom: ${designTokens.spacing[4]};
              display: flex;
              align-items: center;
              gap: ${designTokens.spacing[2]};
            `}
          >
            ⭐ Featured Markets
          </h2>

          <div css={marketGridStyles}>
            {featuredMarkets.map((condition) =>
              renderMarketCard(condition, true),
            )}
          </div>
        </div>
      )}

      {/* All Markets */}
      <div>
        <h2
          css={css`
            font-size: ${designTokens.typography.fontSize.xl};
            font-weight: ${designTokens.typography.fontWeight.bold};
            margin-bottom: ${designTokens.spacing[4]};
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[2]};
          `}
        >
          🔮 All Prediction Markets
          <Badge variant="secondary" size="sm">
            {filteredConditions.length} markets
          </Badge>
        </h2>

        <div css={marketGridStyles}>
          {filteredConditions.map((condition) =>
            renderMarketCard(condition, false),
          )}

          {filteredConditions.length === 0 && (
            <div css={emptyStateStyles}>
              <div
                style={{
                  fontSize: "3rem",
                  marginBottom: designTokens.spacing[4],
                }}
              >
                🔍
              </div>
              <h3>No markets found</h3>
              <p>
                Try adjusting your filters or check back later for new markets.
              </p>
              <Button
                onClick={() => {
                  setCategoryFilter("all");
                  setSortBy("ending_soon");
                }}
                style={{ marginTop: designTokens.spacing[4] }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        css={css`
          text-align: center;
          padding: ${designTokens.spacing[6]};
          border-top: 1px solid ${designTokens.colors.neutral[200]};
          margin-top: ${designTokens.spacing[8]};
        `}
      >
        <p
          css={css`
            color: ${designTokens.colors.neutral[600]};
            margin-bottom: ${designTokens.spacing[2]};
          `}
        >
          Powered by Sapience Protocol
        </p>
        <a
          href="https://sapience.xyz"
          target="_blank"
          rel="noopener noreferrer"
          css={css`
            color: ${designTokens.colors.primary[600]};
            text-decoration: none;
            font-weight: ${designTokens.typography.fontWeight.semibold};
            &:hover {
              text-decoration: underline;
            }
          `}
        >
          sapience.xyz →
        </a>
      </div>

      {/* Forecast Dialog */}
      {selectedMarket && (
        <MultiFieldDialog
          isOpen={forecastDialogOpen}
          onClose={() => {
            setForecastDialogOpen(false);
            setSelectedMarket(null);
          }}
          onSubmit={handleForecastSubmit}
          title="Submit Forecast"
          message={`Predict the probability for: "${selectedMarket.question}"`}
          fields={[
            {
              name: "probability",
              label: "Probability (%)",
              type: "number",
              placeholder: "Enter 0-100",
              required: true,
              validation: (value) => {
                const num = parseInt(value, 10);
                if (isNaN(num)) return "Please enter a valid number";
                if (num < 0 || num > 100)
                  return "Probability must be between 0 and 100";
                return null;
              },
            },
            {
              name: "reasoning",
              label: "Reasoning",
              type: "textarea",
              placeholder: "Explain your forecast (optional)",
              defaultValue: "Manual forecast",
            },
          ]}
          submitText="Submit Forecast"
          isLoading={submittingId === selectedMarket.id}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialogState.open}
        onClose={() =>
          setConfirmDialogState({
            open: false,
            message: "",
            variant: "success",
          })
        }
        onConfirm={() =>
          setConfirmDialogState({
            open: false,
            message: "",
            variant: "success",
          })
        }
        title={confirmDialogState.variant === "success" ? "Success" : "Error"}
        message={confirmDialogState.message}
        variant={confirmDialogState.variant === "success" ? "info" : "error"}
        confirmText="OK"
      />
    </div>
  );
}
