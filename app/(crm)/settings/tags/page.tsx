import { getTags } from "@/app/actions/tags"
import TagsManager from "./TagsManager"

export default async function TagsSettingsPage() {
  const tags = await getTags()
  return <TagsManager initialTags={tags} />
}
