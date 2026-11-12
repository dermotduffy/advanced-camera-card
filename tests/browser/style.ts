// Home Assistant's own values, so that a screenshot taken when a test fails
// looks like the thing a user would have been looking at. Taken from
// hass-frontend's theme globals: resources/theme/typography.globals.ts and
// resources/theme/color/. Only the tokens the card actually reads are here.
const HOME_ASSISTANT_THEME = `
  html {
    --ha-font-family-body: Roboto, Noto, sans-serif;
    --ha-font-size-scale: 1;
    --ha-font-size-m: calc(14px * var(--ha-font-size-scale));

    --primary-text-color: #141414;
    --secondary-text-color: #5e5e5e;
    --text-primary-color: #ffffff;
    --disabled-text-color: #bdbdbd;

    --primary-color: #009ac7;
    --accent-color: #ff9800;
    --divider-color: rgba(0, 0, 0, 0.12);
    --state-icon-color: #44739e;

    --error-color: #db4437;
    --warning-color: #ffa600;
    --success-color: #43a047;
    --info-color: #039be5;

    --ha-color-fill-danger-loud-resting: #dc3146;
    --ha-color-fill-warning-loud-resting: #ff9342;
    --ha-color-fill-neutral-loud-resting: #5e5e5e;

    --rgb-primary-color: 0, 154, 199;
    --rgb-primary-text-color: 33, 33, 33;
    --rgb-secondary-text-color: 114, 114, 114;
    --rgb-card-background-color: 255, 255, 255;

    --card-background-color: #ffffff;
    --primary-background-color: #fafafa;
    --secondary-background-color: #e5e5e5;

    --ha-border-radius-lg: 12px;

    font-family: var(--ha-font-family-body);
    color: var(--primary-text-color);
  }

  /* A dashboard sits the card on the background color with room around it. */
  body {
    background: var(--primary-background-color);
    margin: 0;
    padding: 16px;
  }
`;

const style = document.createElement('style');
style.textContent = HOME_ASSISTANT_THEME;
document.head.append(style);
