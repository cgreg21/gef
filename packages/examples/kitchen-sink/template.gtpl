<GtkBox orientation="vertical" spacing="16" margin-top="20" margin-bottom="20" margin-start="20" margin-end="20">
  <HeaderBar>
    <GtkLabel label="GEF Kitchen Sink" xalign="0" />
    <GtkButton label="Action" />
  </HeaderBar>
  <GtkLabel label="A practical gallery of the native widgets and GTPL layouts currently supported by GEF." xalign="0" />
  <GtkSeparator orientation="horizontal" />
  <GtkLabel label="Actions" xalign="0" />
  <Flex direction="row" gap="8">
    <GtkButton label="Primary action" />
    <GtkButton label="Secondary action" />
    <GtkButton label="Destructive action" />
  </Flex>
  <GtkSeparator orientation="horizontal" />
  <GtkLabel label="Text fields" xalign="0" />
  <GtkEntry placeholder-text="Extension name" />
  <GtkSearchEntry placeholder-text="Search extensions" />
  <GtkPasswordEntry placeholder-text="Password" />
  <GtkSeparator orientation="horizontal" />
  <GtkLabel label="Selection and values" xalign="0" />
  <GtkCheckButton label="Enable automatic updates" active="true" />
  <Flex direction="row" gap="12">
    <GtkLabel label="Notifications" hexpand="true" />
    <GtkSwitch active="true" />
  </Flex>
  <GtkSpinButton value="3" />
  <GtkProgressBar fraction="0.65" show-text="true" text="65%" />
  <GtkSeparator orientation="horizontal" />
  <GtkLabel label="Application layout" xalign="0" />
  <Flex direction="row" gap="12">
    <Sidebar>
      <GtkButton label="Overview" />
      <GtkButton label="Preferences" />
      <GtkButton label="About" />
    </Sidebar>
    <Flex direction="column" gap="8">
      <GtkLabel label="Content area" xalign="0" />
      <GtkLabel label="Flex arranges widgets in rows or columns." xalign="0" />
      <GtkLabel label="Grid places children into fixed columns." xalign="0" />
      <Grid columns="2" gap="8">
        <GtkButton label="General" />
        <GtkButton label="Appearance" />
        <GtkButton label="Network" />
        <GtkButton label="About" />
      </Grid>
    </Flex>
  </Flex>
</GtkBox>
