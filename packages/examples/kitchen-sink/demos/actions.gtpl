<Flex direction="column" gap="16" margin-top="20">
  <GtkLabel label="Actions and feedback" xalign="0" />
  <GtkLabel label="Choose the action that matches the task. Native GTK buttons retain their platform styling." xalign="0" />
  <Flex direction="row" gap="8">
    <GtkButton label="Create extension" />
    <GtkButton label="Preview" />
  </Flex>
  <GtkSeparator orientation="horizontal" />
  <GtkLabel label="Destructive action" xalign="0" />
  <Flex direction="row" gap="8">
    <GtkButton label="Remove extension" />
    <GtkButton label="Cancel" />
  </Flex>
  <GtkLabel label="Button groups can be composed with Flex and Grid." xalign="0" />
  <Grid columns="2" gap="8">
    <GtkButton label="General" />
    <GtkButton label="Appearance" />
    <GtkButton label="Keyboard" />
    <GtkButton label="About" />
  </Grid>
</Flex>