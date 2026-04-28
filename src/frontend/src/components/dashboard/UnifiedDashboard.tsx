           {isMobile ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate("/policies")}
              >
                + Policy
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  Refresh
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate("/policies")}
                >
                  Deploy Policy
                </Button>
              </>
            )}
