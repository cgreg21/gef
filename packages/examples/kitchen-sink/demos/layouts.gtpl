<Flex direction="column" gap="16" margin-top="20">
  <GtkLabel label="Layout patterns" xalign="0" />
  <GtkLabel label="Flex creates horizontal and vertical groups. Grid aligns related actions." xalign="0" />
  <Flex direction="row" gap="12">
    <Sidebar>
      <GtkButton label="Overview" />
      <GtkButton label="Preferences" />
      <GtkButton label="Extensions" />
    </Sidebar>
    <Flex direction="column" gap="8">
      <GtkLabel label="Main content" xalign="0" />
      <GtkLabel label="A content area can combine nested layouts." xalign="0" />
      <Grid columns="2" gap="8">
        <GtkButton label="General" />
        <GtkButton label="Appearance" />
        <GtkButton label="Network" />
        <GtkButton label="About" />
      </Grid>
    </Flex>
  </Flex>
  <GtkSeparator orientation="horizontal" />
  <GtkLabel label="Progress and values" xalign="0" />
  <GtkProgressBar fraction="0.65" show-text="true" text="65%" />
  <GtkScale value="0.4" />
</Flex>