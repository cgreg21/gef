<Flex direction="column" gap="14" margin-top="20">
  <GefSectionHeader title="Create an extension" description="A practical form composed from GEF UI components and layout primitives." />
  <GefLabel text="Basic information" />
  <GefLabel text="Extension name" />
  <GefInput placeholder="e.g. Workspace Navigator" />
  <GefLabel text="Description" />
  <GefTextArea />
  <GefLabel text="Search a package" />
  <GefSearchInput placeholder="Search packages…" />
  <GefLabel text="Credentials" />
  <GefPasswordInput [showPeekIcon]="true" />
  <Flex direction="row" gap="8">
    <GefButton label="Cancel" />
    <GefButton label="Create extension" />
  </Flex>
</Flex>
