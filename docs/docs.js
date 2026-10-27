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
const mobileToc = document.querySelector('[data-mobile-toc]')
const codeBlocks = [...document.querySelectorAll('.docs-code')]

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

/** 根据正文二级标题生成右侧和移动端页内目录。 */
function buildTableOfContents() {
  if (!article || !tocNav || !mobileToc) return
  const headings = [...article.querySelectorAll('h2[id]')]
  const desktopFragment = document.createDocumentFragment()
  const mobileFragment = document.createDocumentFragment()

  for (const heading of headings) {
    const desktopLink = document.createElement('a')
    desktopLink.href = `#${heading.id}`
    desktopLink.textContent = heading.textContent ?? ''
    desktopLink.dataset.tocTarget = heading.id
    desktopFragment.append(desktopLink)

    const mobileItem = document.createElement('li')
    const mobileLink = document.createElement('a')
    mobileLink.href = `#${heading.id}`
    mobileLink.textContent = heading.textContent ?? ''
    mobileItem.append(mobileLink)
    mobileFragment.append(mobileItem)
  }

  tocNav.replaceChildren(desktopFragment)
  mobileToc.replaceChildren(mobileFragment)
}

buildTableOfContents()

const tocLinks = [...document.querySelectorAll('[data-toc-target]')]
const observedHeadings = tocLinks
  .map((link) => document.getElementById(link.dataset.tocTarget ?? ''))
  .filter((heading) => heading !== null)

/** 高亮当前正文小节，并同步右侧目录的 aria-current。 */
function setActiveSection(id) {
  for (const link of tocLinks) {
    if (link.dataset.tocTarget === id) {
      link.setAttribute('aria-current', 'location')
    } else {
      link.removeAttribute('aria-current')
    }
  }
}

if ('IntersectionObserver' in window && observedHeadings.length > 0) {
  const visibleSections = new Map()
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visibleSections.set(entry.target.id, entry.boundingClientRect.top)
        } else {
          visibleSections.delete(entry.target.id)
        }
      }
      const current = [...visibleSections.entries()].sort((left, right) => left[1] - right[1])[0]
      if (current) setActiveSection(current[0])
    },
    { rootMargin: '-18% 0px -68% 0px', threshold: 0 },
  )
  for (const heading of observedHeadings) sectionObserver.observe(heading)
} else {
  setActiveSection(observedHeadings[0]?.id ?? '')
}

/** 顶部细线显示整篇手册的阅读进度。 */
function updateReadingProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0
  document.documentElement.style.setProperty('--docs-progress', `${progress * 100}%`)
}

updateReadingProgress()
window.addEventListener('scroll', updateReadingProgress, { passive: true })
window.addEventListener('resize', updateReadingProgress)

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
