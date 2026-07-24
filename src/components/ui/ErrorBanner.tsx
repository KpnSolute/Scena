import { WarningCircle } from "@phosphor-icons/react";
import { isScenaApiError } from "../../services/scena-api/errors";
import { Button } from "./Button";

export interface ErrorBannerProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}

/** Renders a stable, non-leaking error surface. Branches on error.code, never on message text. */
export function ErrorBanner({ error, title, onRetry }: ErrorBannerProps) {
  const scenaError = isScenaApiError(error) ? error : null;
  const message = scenaError?.message ?? (error instanceof Error ? error.message : "Something went wrong.");
  const heading = title ?? friendlyTitle(scenaError?.code);

  return (
    <div className="scena-error-banner" role="alert">
      <WarningCircle size={20} weight="fill" className="scena-error-banner__icon" />
      <div style={{ flex: 1 }}>
        <div className="scena-error-banner__title">{heading}</div>
        <div className="scena-error-banner__message">{message}</div>
        {scenaError?.requestId && (
          <details className="scena-error-banner__details">
            <summary>Technical details</summary>
            <pre>
              code: {scenaError.code}
              {"\n"}status: {scenaError.status}
              {"\n"}request_id: {scenaError.requestId}
            </pre>
          </details>
        )}
        {onRetry && (
          <div style={{ marginTop: 12 }}>
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function friendlyTitle(code?: string): string {
  switch (code) {
    case "UNAUTHENTICATED":
      return "Sign-in required";
    case "WORKSPACE_ACCESS_DENIED":
    case "WORKSPACE_SUSPENDED":
      return "Workspace access unavailable";
    case "EDITOR_ROLE_REQUIRED":
      return "Editor role required";
    case "ASSET_UPLOAD_LIMIT_REACHED":
      return "Monthly upload limit reached";
    case "ASSET_TOO_LARGE":
      return "File too large";
    case "UNSUPPORTED_ASSET_TYPE":
      return "File type not supported";
    case "SOURCE_UPLOAD_FAILED":
      return "Upload could not be completed";
    case "UPLOAD_INCOMPLETE":
      return "Upload is incomplete";
    case "ASSET_NOT_FOUND":
      return "Asset not found";
    case "VARIANT_NOT_FOUND":
      return "Preview unavailable";
    case "PREVIEW_NOT_AVAILABLE":
      return "Preview is still processing";
    case "PROCESSING_FAILED":
      return "Asset processing failed";
    case "PROCESSING_TIMEOUT":
      return "Asset is still processing";
    case "BOARD_LIMIT_REACHED":
      return "Board limit reached";
    case "BOARD_VERSION_CONFLICT":
      return "This Board changed elsewhere";
    case "BOARD_VALIDATION_FAILED":
      return "Board couldn't be saved";
    case "API_UNAVAILABLE":
      return "Scena is temporarily unavailable";
    default:
      return "Something went wrong";
  }
}
