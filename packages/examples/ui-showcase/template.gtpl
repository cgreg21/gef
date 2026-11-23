<GtkBox orientation="vertical" spacing="14" margin-top="24" margin-bottom="24" margin-start="24" margin-end="24">
  <GtkLabel label="GEF UI Showcase" xalign="0" />
  <GtkLabel label="Native GTK4 components rendered from a GTPL template" xalign="0" />
  <GtkSeparator />
  <GtkLabel label="Buttons" xalign="0" />
  <GtkBox orientation="horizontal" spacing="8">
    <GtkButton label="Primary action" />
    <GtkButton label="Secondary action" />
  </GtkBox>
  <GtkLabel label="Text input" xalign="0" />
  <GtkEntry placeholder-text="Enter an extension name…" />
  <GtkLabel label="Selection controls" xalign="0" />
  <GtkCheckButton label="Enable automatic updates" active="true" />
  <GtkBox orientation="horizontal" spacing="12">
    <GtkLabel label="Notifications" hexpand="true" />
    <GtkSwitch active="true" />
  </GtkBox>
  <GtkLabel label="Progress" xalign="0" />
  <GtkProgressBar fraction="0.65" show-text="true" text="65%" />
  <GtkLabel label="Layout: Flex and Grid are available as GTPL containers." xalign="0" />
  <GtkGrid column-spacing="8" row-spacing="8">
    <GtkButton label="General" />
    <GtkButton label="Appearance" />
    <GtkButton label="Network" />
    <GtkButton label="About" />
  </GtkGrid>
</GtkBox>
