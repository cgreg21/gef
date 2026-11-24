<Flex direction="column" gap="16" margin-top="20">
  <GefSectionHeader title="Welcome back" description="Your workspace at a glance" />
  <Grid columns="2" gap="12">
    <GefMetricCard title="Installed extensions" value="12" detail="2 updates available" />
    <GefMetricCard title="System status" value="Operational" detail="Last checked just now" />
  </Grid>
  <GtkSeparator orientation="horizontal" />
  <GtkLabel label="Recent activity" xalign="0" />
  <Flex direction="row" gap="12">
    <GtkLabel label="Updated" />
    <GtkLabel label="Window controls" xalign="0" />
    <GtkLabel label="Today, 09:42" />
  </Flex>
  <Flex direction="row" gap="12">
    <GtkLabel label="Added" />
    <GtkLabel label="Workspace indicator" xalign="0" />
    <GtkLabel label="Yesterday" />
  </Flex>
</Flex>