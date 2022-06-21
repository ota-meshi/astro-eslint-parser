---
layout: ../layouts/BaseLayout.astro
setup: |
  import Author from '../../components/Author.astro'
  import Biography from '../components/Biography.jsx'
author: Leon
---

<Author name={frontmatter.author}/>
<Biography client:visible>
  {frontmatter.author} lives in Toronto, Canada and enjoys photography.
</Biography>
