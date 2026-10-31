/**
 * clawsmith 使用手册交互。
 * 负责移动端侧栏、文档搜索、页内目录、阅读进度和代码复制，不依赖第三方脚本。
 */
const body = document.body
const menuToggle = document.querySelector('[data-docs-menu-toggle]')
const sidebar = document.querySelector('[data-docs-sidebar]')
const overlay = document.querySelector('[data-docs-overlay]')
const searchInput = document.querySelector('[data-docs-search]')
const searchEmpty = document.querySelector('[data-docs-search-empty]')
const searchTriggers = [...document.querySelectorAll('[data-focus-docs-search]')]
const navItems = [...document.querySelectorAll('[data-doc-link]')]
const navGroups = [...document.querySelectorAll('[data-doc-group]')]
const article = document.querySelector('[data-docs-article]')
const tocNav = document.querySelector('[data-docs-toc]')
const tocTitle = document.querySelector('[data-docs-toc-title]')
const tocCaption = document.querySelector('[data-docs-toc-caption]')
const mobileToc = document.querySelector('[data-mobile-toc]')
const codeBlocks = [...document.querySelectorAll('.docs-code')]
const codeTabGroups = [...document.querySelectorAll('[data-code-tabs]')]

/** 同步移动端抽屉的可聚焦状态，避免键盘进入屏幕外导航。 */
function syncSidebarAccessibility() {
  if (!sidebar) return
  const mobile = window.innerWidth <= 900
  const open = body.classList.contains('docs-menu-open')
  sidebar.inert = mobile && !open
  sidebar.setAttribute('aria-hidden', String(mobile && !open))
  if (overlay) {
    overlay.tabIndex = mobile && open ? 0 : -1
  }
}

/** 关闭移动端文档侧栏，并同步按钮和遮罩状态。 */
function closeSidebar() {
  body.classList.remove('docs-menu-open')
  menuToggle?.setAttribute('aria-expanded', 'false')
  syncSidebarAccessibility()
}

/** 打开文档侧栏，并把焦点移动到搜索框。 */
function openSidebar() {
  body.classList.add('docs-menu-open')
  menuToggle?.setAttribute('aria-expanded', 'true')
  syncSidebarAccessibility()
  window.requestAnimationFrame(() => searchInput?.focus())
}

syncSidebarAccessibility()

if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    if (body.classList.contains('docs-menu-open')) {
      closeSidebar()
    } else {
      openSidebar()
    }
  })
}

overlay?.addEventListener('click', closeSidebar)

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSidebar()
  }

  const target = event.target
  const editing =
    target instanceof HTMLElement &&
    (target.matches('input, textarea, select') || target.isContentEditable)

  // “/” 是终端用户的自然搜索手势；只在非编辑状态聚焦文档搜索。
  if (!editing && event.key === '/') {
    event.preventDefault()
    if (window.innerWidth <= 900) {
      openSidebar()
    } else {
      searchInput?.focus()
    }
  }
})

for (const trigger of searchTriggers) {
  trigger.addEventListener('click', () => {
    if (window.innerWidth <= 900) {
      openSidebar()
    } else {
      searchInput?.focus()
    }
  })
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLocaleLowerCase()
    let visibleCount = 0

    for (const item of navItems) {
      const haystack = `${item.textContent ?? ''} ${item.getAttribute('data-keywords') ?? ''}`
        .toLocaleLowerCase()
        .trim()
      const matches = query.length === 0 || haystack.includes(query)
      item.hidden = !matches
      if (matches) visibleCount += 1
    }

    for (const group of navGroups) {
      const visibleLinks = [...group.querySelectorAll('[data-doc-link]')].filter(
        (link) => !link.hidden,
      )
      group.hidden = visibleLinks.length === 0
      if (query && visibleLinks.length > 0) {
        group.open = true
      }
    }

    const activeVisibleGroup = docGroups.find(
      (group) => group.id === activeGroupId && !group.group.hidden,
    )
    const firstVisibleGroup = activeVisibleGroup ?? docGroups.find((group) => !group.group.hidden)
    if (firstVisibleGroup) {
      const firstVisibleLink =
        firstVisibleGroup.links.find(
          (link) => link.id === activeSectionId && !link.source.hidden,
        ) ?? firstVisibleGroup.links.find((link) => !link.source.hidden)
      if (firstVisibleLink) setActiveSection(firstVisibleLink.id)
    } else {
      tocNav?.replaceChildren()
      mobileToc?.replaceChildren()
      if (tocTitle) tocTitle.textContent = '暂无匹配内容'
      if (tocCaption) tocCaption.textContent = '0 个主题'
    }

    if (searchEmpty) {
      searchEmpty.hidden = visibleCount > 0
    }
  })
}

for (const link of navItems) {
  link.addEventListener('click', closeSidebar)
}

window.addEventListener('resize', () => {
  if (window.innerWidth > 900) {
    closeSidebar()
  }
  syncSidebarAccessibility()
})

/** 左侧一级分组与二级文档入口；右侧只显示当前二级文档内部的 h3。 */
const docGroups = navGroups.map((group, index) => ({
  group,
  id: group.dataset.docGroupId ?? `group-${index}`,
  label: group.querySelector(':scope > summary')?.textContent?.trim() ?? `分组 ${index + 1}`,
  links: [...group.querySelectorAll('[data-doc-link]')].map((link) => ({
    id: link.hash.replace(/^#/, ''),
    label: link.textContent?.trim() ?? '',
    source: link,
  })),
}))
const observedSections = article ? [...article.querySelectorAll('h2[id]')] : []
const requestedSectionId = window.location.hash.replace(/^#/, '')
const requestedGroup = findGroupForSection(requestedSectionId)
let activeGroupId = requestedGroup?.id ?? docGroups[0]?.id ?? ''
let activeSectionId = (requestedGroup ? requestedSectionId : docGroups[0]?.links[0]?.id) ?? ''
let activeSubsectionId = ''
let pendingNavigationId = ''
let pendingNavigationDeadline = 0
const usedHeadingIds = new Set(observedSections.map((heading) => heading.id))

function findGroupForSection(id) {
  return docGroups.find((group) => group.links.some((link) => link.id === id))
}

function sectionLabel(id) {
  return (
    document.getElementById(id)?.textContent?.trim() ??
    docGroups.flatMap((group) => group.links).find((link) => link.id === id)?.label ??
    ''
  )
}

/** 为正文 h3 补稳定锚点，右侧目录才能定位到二级文档内部主题。 */
function ensureSubsectionIds(section) {
  if (!section) return []
  const sectionId =
    section.querySelector('h2[id]')?.id ?? section.getAttribute('aria-labelledby') ?? 'section'
  return [...section.querySelectorAll('h3')].map((heading, index) => {
    if (heading.id) {
      usedHeadingIds.add(heading.id)
      return heading
    }
    const base =
      (heading.textContent ?? 'section')
        .trim()
        .toLocaleLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || `topic-${index + 1}`
    let id = `${sectionId}-${base}`
    let suffix = 2
    while (usedHeadingIds.has(id)) {
      id = `${sectionId}-${base}-${suffix++}`
    }
    heading.id = id
    usedHeadingIds.add(id)
    return heading
  })
}

/** 重绘右侧和移动端目录，只展示当前二级文档的 h3；无 h3 时回退到本节概览。 */
function renderTableOfContents() {
  if (!tocNav || !mobileToc) return
  const anchor = document.getElementById(activeSectionId)
  const section = anchor?.closest('.docs-section') ?? anchor
  const headings = ensureSubsectionIds(section)
  const entries =
    headings.length > 0
      ? headings.map((heading) => ({
          id: heading.id,
          label: heading.textContent?.trim() ?? '',
        }))
      : activeSectionId
        ? [{ id: activeSectionId, label: '本节概览' }]
        : []
  const desktopFragment = document.createDocumentFragment()
  const mobileFragment = document.createDocumentFragment()

  for (const entry of entries) {
    const desktopLink = document.createElement('a')
    desktopLink.href = `#${entry.id}`
    desktopLink.textContent = entry.label
    desktopLink.dataset.tocTarget = entry.id
    desktopFragment.append(desktopLink)

    const mobileItem = document.createElement('li')
    const mobileLink = document.createElement('a')
    mobileLink.href = `#${entry.id}`
    mobileLink.textContent = entry.label
    mobileItem.append(mobileLink)
    mobileFragment.append(mobileItem)
  }

  tocNav.replaceChildren(desktopFragment)
  mobileToc.replaceChildren(mobileFragment)
  if (tocTitle) tocTitle.textContent = sectionLabel(activeSectionId) || '暂无匹配内容'
  if (tocCaption) {
    tocCaption.textContent = headings.length > 0 ? `${headings.length} 个主题` : '本节概览'
  }
}

/** 同步左侧一级分组的高亮和展开状态。 */
function setActiveGroup(id, options = {}) {
  const next = docGroups.find((group) => group.id === id)
  if (!next) return
  activeGroupId = next.id
  for (const group of docGroups) {
    const active = group.id === activeGroupId
    group.group.classList.toggle('is-current', active)
    group.group.querySelector(':scope > summary')?.setAttribute('aria-current', String(active))
    if (active && options.open) group.group.open = true
    if (!active && options.exclusive) group.group.open = false
  }
}

for (const group of docGroups) {
  for (const link of group.links) {
    link.source.addEventListener('click', () => {
      pendingNavigationId = link.id
      pendingNavigationDeadline = performance.now() + 2_500
      setActiveSection(link.id)
    })
  }
}

/** 选中左侧二级文档入口，并生成它自己的右侧 h3 目录。 */
function setActiveSection(id) {
  if (!id) return
  activeSectionId = id
  activeSubsectionId = ''
  const group = findGroupForSection(id)
  if (group) {
    activeGroupId = group.id
    setActiveGroup(group.id, { open: true, exclusive: true })
  }
  renderTableOfContents()
  for (const navLink of navItems) {
    if (navLink.hash === `#${id}`) {
      navLink.setAttribute('aria-current', 'location')
    } else {
      navLink.removeAttribute('aria-current')
    }
  }
  const fallback = document.querySelector('[data-toc-target]')
  if (fallback) fallback.setAttribute('aria-current', 'location')
}

setActiveSection(activeSectionId)

/**
 * 根据当前滚动位置计算活动二级章节和章节内 h3。
 * 直接读取有限的标题位置，避免长文档锚点跳转时 IntersectionObserver 漏报。
 */
function syncActiveFromScroll() {
  const boundary = Math.max(120, Math.min(340, window.innerHeight * 0.32))
  let currentSection = observedSections[0]

  for (const heading of observedSections) {
    if (heading.getBoundingClientRect().top <= boundary) {
      currentSection = heading
    } else {
      break
    }
  }

  // 平滑锚点滚动会经过中间章节；到达目标前保持用户点击的章节，避免右侧目录来回抖动。
  if (pendingNavigationId) {
    if (
      currentSection?.id === pendingNavigationId ||
      performance.now() > pendingNavigationDeadline
    ) {
      pendingNavigationId = ''
    } else {
      return
    }
  }

  if (currentSection && currentSection.id !== activeSectionId) {
    setActiveSection(currentSection.id)
  }

  const section = currentSection?.closest('.docs-section')
  if (!section) return
  const headings = ensureSubsectionIds(section)
  let currentHeading = headings[0]
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top <= boundary + 48) {
      currentHeading = heading
    } else {
      break
    }
  }
  activeSubsectionId = currentHeading?.id ?? ''

  for (const link of document.querySelectorAll('[data-docs-toc] a, [data-mobile-toc] a')) {
    if (link.getAttribute('href') === `#${activeSubsectionId}`) {
      link.setAttribute('aria-current', 'location')
    } else {
      link.removeAttribute('aria-current')
    }
  }
}

let scrollSyncFrame = 0
const scheduleScrollSync = () => {
  if (scrollSyncFrame !== 0) return
  scrollSyncFrame = window.requestAnimationFrame(() => {
    scrollSyncFrame = 0
    syncActiveFromScroll()
  })
}

window.addEventListener('scroll', scheduleScrollSync, { passive: true })
window.addEventListener('resize', scheduleScrollSync)
window.addEventListener(
  'wheel',
  () => {
    pendingNavigationId = ''
  },
  { passive: true },
)
window.addEventListener(
  'touchstart',
  () => {
    pendingNavigationId = ''
  },
  { passive: true },
)
window.addEventListener('hashchange', () => {
  const id = window.location.hash.replace(/^#/, '')
  if (docGroups.some((group) => group.links.some((link) => link.id === id))) {
    pendingNavigationId = id
    pendingNavigationDeadline = performance.now() + 2_500
    setActiveSection(id)
  }
})
scheduleScrollSync()

/** 顶部细线显示整篇手册的阅读进度。 */
function updateReadingProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0
  document.documentElement.style.setProperty('--docs-progress', `${progress * 100}%`)
}

updateReadingProgress()
window.addEventListener('scroll', updateReadingProgress, { passive: true })
window.addEventListener('resize', updateReadingProgress)

/** 切换安装/语言示例，避免把同一能力的不同入口摊成多页。 */
for (const group of codeTabGroups) {
  const tabs = [...group.querySelectorAll('[data-code-tab]')]
  const panels = [...group.querySelectorAll('[data-code-panel]')]

  const select = (id) => {
    for (const tab of tabs) {
      tab.setAttribute('aria-selected', String(tab.dataset.codeTab === id))
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.codePanel !== id
    }
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab.dataset.codeTab ?? ''))
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const current = tabs.indexOf(tab)
      const offset = event.key === 'ArrowRight' ? 1 : -1
      const next = tabs[(current + offset + tabs.length) % tabs.length]
      if (!next) return
      select(next.dataset.codeTab ?? '')
      next.focus()
    })
  }
}

/** 给每个代码块追加复制按钮，复制失败时保留原始代码供手工选择。 */
for (const block of codeBlocks) {
  const pre = block.querySelector('pre')
  if (!pre) continue

  const button = document.createElement('button')
  button.className = 'docs-copy'
  button.type = 'button'
  button.textContent = '复制'
  button.setAttribute('aria-label', '复制代码')
  block.append(button)

  button.addEventListener('click', async () => {
    const label = button.textContent
    try {
      await navigator.clipboard.writeText(pre.textContent?.trim() ?? '')
      button.textContent = '已复制'
    } catch {
      button.textContent = '复制失败'
    }
    window.setTimeout(() => {
      button.textContent = label
    }, 1500)
  })
}

const year = document.querySelector('[data-current-year]')
if (year) {
  year.textContent = String(new Date().getFullYear())
}
