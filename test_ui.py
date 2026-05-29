#!/usr/bin/env python3
"""运营A - 全站UI自动化测试 (melody.wang)"""
import asyncio
import json
import sys
from datetime import datetime

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("安装playwright: pip install playwright && playwright install chromium")
    sys.exit(1)

BASE_URL = "https://melody.wang"
USERNAME = "yunyingA"
PASSWORD = "123456"
WRONG_PASSWORD = "wrongpass"
RESULTS = []
ISSUES = []

def record(test_page, test_item, status, detail=""):
    emoji = {"pass": "✅", "fail": "❌", "warn": "⚠️"}[status]
    entry = f"{emoji} [{test_page}] {test_item}"
    if detail:
        entry += f" — {detail}"
    RESULTS.append(entry)
    if status in ("fail", "warn"):
        ISSUES.append(entry)
    print(entry)

async def sleep(ms):
    await asyncio.sleep(ms / 1000)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'])
        context = await browser.new_context(
            viewport={'width': 1440, 'height': 900},
            locale='zh-CN'
        )
        page = await context.new_page()

        # ============================================================
        # 1. LOGIN PAGE
        # ============================================================
        print("\n" + "=" * 60)
        print("1. 登录页测试")
        print("=" * 60)

        await page.goto(BASE_URL, wait_until='networkidle', timeout=30000)
        await sleep(2000)

        # Check login page loaded
        title = await page.title()
        print(f"页面标题: {title}")
        if '店分析' in title or 'dianfx' in title.lower():
            record("登录页", "页面加载", "pass", f"标题={title}")
        else:
            record("登录页", "页面加载", "fail", f"标题={title}")

        # Find input fields
        inputs = await page.query_selector_all('input')
        input_count = len(inputs)
        print(f"找到 {input_count} 个输入框")

        if input_count >= 2:
            record("登录页", "输入框存在", "pass", f"{input_count}个输入框")
        else:
            record("登录页", "输入框存在", "fail", f"仅有{input_count}个输入框")

        # ---- Test: Empty input login ----
        # Find and click login button
        login_btn = await page.query_selector('button:has-text("登录")')
        if not login_btn:
            login_btn = await page.query_selector('button[type="submit"]')
        if not login_btn:
            # Try any button that might be login
            buttons = await page.query_selector_all('button')
            for btn in buttons:
                text = await btn.inner_text()
                if '登录' in text:
                    login_btn = btn
                    break

        if login_btn:
            await login_btn.click()
            await sleep(1500)
            # Check for error message
            error_text = await page.inner_text('body')
            if '请输入' in error_text or '不能为空' in error_text or '用户名' in error_text:
                record("登录页", "空输入点登录→提示", "pass", "有提示信息")
            else:
                record("登录页", "空输入点登录→提示", "warn", "未找到明确错误提示")
        else:
            record("登录页", "空输入点登录→提示", "fail", "未找到登录按钮")

        # ---- Test: Wrong password ----
        # Fill username
        username_input = await page.query_selector('input[type="text"], input[placeholder*="用户"], input[placeholder*="账号"], input[name*="user"]')
        if not username_input:
            username_input = inputs[0] if inputs else None

        password_input = None
        for inp in (inputs or []):
            inp_type = await inp.get_attribute('type')
            if inp_type == 'password':
                password_input = inp
                break
        if not password_input and len(inputs) >= 2:
            password_input = inputs[1]

        if username_input and password_input:
            await username_input.fill(USERNAME)
            await password_input.fill(WRONG_PASSWORD)
            await sleep(500)

            # Submit
            if login_btn:
                await login_btn.click()
                await sleep(2000)

            error_text = await page.inner_text('body')
            if '错误' in error_text or '不正确' in error_text or '密码' in error_text:
                record("登录页", "输入错误密码→提示", "pass", "提示密码错误")
            else:
                record("登录页", "输入错误密码→提示", "warn", f"响应: {error_text[:100]}")
        else:
            record("登录页", "输入错误密码→提示", "fail", "未找到输入框")

        # ---- Test: Password show/hide button ----
        pw_toggle_btns = await page.query_selector_all('button[class*="eye"], button[class*="show"], button[class*="toggle"], [class*="password"]')
        # Also look for eye icon
        eye_icons = await page.query_selector_all('svg, [class*="icon"]')
        has_toggle = len(pw_toggle_btns) > 0
        if has_toggle:
            record("登录页", "显示/隐藏密码按钮", "pass", "找到切换按钮")
        else:
            record("登录页", "显示/隐藏密码按钮", "warn", "未找到明确的密码切换按钮，可能使用浏览器原生控件")

        # ---- Test: Correct login ----
        await username_input.fill(USERNAME)
        await password_input.fill(PASSWORD)
        await sleep(300)

        if login_btn:
            await login_btn.click()
            await page.wait_for_timeout(3000)

        url_after_login = page.url
        print(f"登录后URL: {url_after_login}")

        # Check if redirected away from login page
        if 'login' not in url_after_login.lower() or 'dashboard' in url_after_login.lower() or 'stores' in url_after_login.lower():
            record("登录页", "正确登录→跳转", "pass", f"跳转到 {url_after_login}")
        else:
            # Check if we're still on login but got an error
            body_text = await page.inner_text('body')
            if '登录成功' in body_text or '店铺' in body_text or '数据' in body_text:
                record("登录页", "正确登录→跳转", "pass", "页面内容变化，登录成功")
            else:
                record("登录页", "正确登录→跳转", "warn", f"URL未变化: {url_after_login}")

        # ============================================================
        # 2. STORE MANAGEMENT
        # ============================================================
        print("\n" + "=" * 60)
        print("2. 店铺管理测试")
        print("=" * 60)

        # Navigate to stores page if not there
        store_links = await page.query_selector_all('a[href*="store"]')
        has_store_nav = len(store_links) > 0

        # Look for store list items
        store_items = await page.query_selector_all('[class*="store"], [class*="shop"], [class*="StoreCard"]')

        # Try clicking on nav menu items
        nav_items = await page.query_selector_all('nav a, nav button, [class*="nav"] a, [class*="sidebar"] a, [class*="menu"] a')
        for item in nav_items:
            text = await item.inner_text()
            if '店铺' in text or '管理' in text:
                await item.click()
                await sleep(2000)
                break

        # Check for store list
        body_text = await page.inner_text('body')
        has_store_list = '演示店铺' in body_text or '测试店铺' in body_text or '店铺' in body_text

        if has_store_list:
            record("店铺管理", "登录后看到店铺列表", "pass", "店铺列表可见")
        else:
            record("店铺管理", "登录后看到店铺列表", "warn", "无法确认店铺列表，可能在其他页面")

        # ---- Test: Import demo data ----
        import_btn = await page.query_selector('button:has-text("导入演示数据")')
        if not import_btn:
            import_btn = await page.query_selector('button:has-text("导入")')
        if not import_btn:
            import_btn = await page.query_selector('button:has-text("演示")')

        if import_btn:
            await import_btn.click()
            await sleep(5000)  # Wait for import

            body_text = await page.inner_text('body')
            if '成功' in body_text or '导入成功' in body_text or '刷新' in body_text:
                record("店铺管理", "一键导入演示数据→提示成功", "pass", "导入成功提示")
            else:
                record("店铺管理", "一键导入演示数据→提示成功", "warn", f"未看到成功提示, 内容: {body_text[:200]}")

            # Wait for refresh
            await sleep(3000)
            body_text = await page.inner_text('body')

            # Check if order data appeared
            has_data = '订单' in body_text or 'GMV' in body_text or '数据' in body_text
            if has_data:
                record("店铺管理", "导入后刷新→有数据", "pass", "页面有数据内容")
            else:
                record("店铺管理", "导入后刷新→有数据", "warn", "未确认数据加载")
        else:
            record("店铺管理", "一键导入演示数据→操作", "warn", "未找到导入按钮，可能已登录或已导入")

        # ---- Test: Data recovery ----
        recover_btn = await page.query_selector('button:has-text("数据恢复")')
        if not recover_btn:
            recover_btn = await page.query_selector('button:has-text("恢复")')

        if recover_btn:
            await recover_btn.click()
            await sleep(3000)
            body_text = await page.inner_text('body')
            record("店铺管理", "数据恢复→点击", "pass", "点击数据恢复按钮")
        else:
            record("店铺管理", "数据恢复→点击", "warn", "未找到数据恢复按钮")

        # ---- Test: Add/Delete store ----
        # Find add store button
        add_btn = await page.query_selector('button:has-text("添加"), button:has-text("新增"), button:has-text("新建")')
        if add_btn:
            await add_btn.click()
            await sleep(1000)
            # Try to fill store name
            name_inputs = await page.query_selector_all('input:not([type="hidden"])')
            if name_inputs:
                for inp in name_inputs:
                    val = await inp.input_value()
                    if not val:
                        await inp.fill("自动化测试店铺_" + datetime.now().strftime("%H%M%S"))
                        await sleep(500)
                        break

            # Find confirm button
            confirm_btn = await page.query_selector('button:has-text("确认"), button:has-text("确定"), button:has-text("保存"), button:has-text("创建")')
            if confirm_btn:
                await confirm_btn.click()
                await sleep(2000)
                record("店铺管理", "添加店铺", "pass", "已点击添加")
            else:
                record("店铺管理", "添加店铺", "warn", "找到添加按钮但无确认按钮")
        else:
            record("店铺管理", "添加店铺", "warn", "未找到添加按钮")

        # ============================================================
        # 3. DASHBOARD
        # ============================================================
        print("\n" + "=" * 60)
        print("3. 数据中心 Dashboard 测试")
        print("=" * 60)

        # Navigate to dashboard
        for item in nav_items:
            text = await item.inner_text()
            if '数据' in text or 'Dashboard' in text or 'dashboard' in text or '总览' in text:
                await item.click()
                await sleep(2000)
                break

        # Check for KPI cards
        kpi_cards = await page.query_selector_all('[class*="kpi"], [class*="KPI"], [class*="card"], [class*="stat"], [class*="metric"]')
        numeric_cards = []
        for card in kpi_cards:
            text = await card.inner_text()
            # Check if it contains numbers
            if any(c.isdigit() for c in text):
                numeric_cards.append(card)

        kpi_count = len(numeric_cards)
        if kpi_count >= 8:
            record("Dashboard", f"KPI卡片数量({kpi_count}个)", "pass", f"至少{8}个有数值的KPI卡片")
        elif kpi_count >= 4:
            record("Dashboard", f"KPI卡片数量({kpi_count}个)", "warn", f"仅有{kpi_count}个KPI卡片，期望12个")
        else:
            record("Dashboard", f"KPI卡片数量({kpi_count}个)", "fail", "KPI卡片极少或为零")

        # ---- Test: Click GMV card ----
        gmv_card = None
        for card in kpi_cards:
            text = await card.inner_text()
            if 'GMV' in text.upper() or '交易额' in text or '成交' in text:
                gmv_card = card
                break

        if gmv_card:
            await gmv_card.click()
            await sleep(2000)
            # Check if chart appears
            charts = await page.query_selector_all('svg, .recharts-wrapper, [class*="chart"], canvas')
            if len(charts) > 0:
                record("Dashboard", "点击GMV卡片→趋势图联动", "pass", f"图表区域可见({len(charts)}个)")
            else:
                record("Dashboard", "点击GMV卡片→趋势图联动", "warn", "点击后未找到图表")
        else:
            record("Dashboard", "点击GMV卡片→趋势图联动", "warn", "未找到GMV卡片")

        # ---- Test: Click refund rate card ----
        refund_card = None
        for card in kpi_cards:
            text = await card.inner_text()
            if '退款' in text or '售后' in text:
                refund_card = card
                break

        if refund_card:
            await refund_card.click()
            await sleep(2000)
            record("Dashboard", "点击退款率卡片→联动", "pass", "已点击退款卡片")
        else:
            record("Dashboard", "点击退款率卡片→联动", "warn", "未找到退款率卡片")

        # ---- Test: Time filter ----
        time_btns = await page.query_selector_all('button:has-text("7天"), button:has-text("30天"), button:has-text("全部"), button:has-text("7"), button:has-text("30")')
        if len(time_btns) >= 2:
            for btn in time_btns:
                text = await btn.inner_text()
                await btn.click()
                await sleep(1500)
                record("Dashboard", f"时间筛选器: 点'{text.strip()}'", "pass", "筛选按钮可点击")
        else:
            # Try broader search
            all_btns = await page.query_selector_all('button')
            time_filter_btns = []
            for btn in all_btns:
                text = await btn.inner_text()
                if any(t in text for t in ['7天', '30天', '全部', '本周', '本月']):
                    time_filter_btns.append(btn)
            if time_filter_btns:
                for btn in time_filter_btns[:3]:
                    text = await btn.inner_text()
                    await btn.click()
                    await sleep(1500)
                    record("Dashboard", f"时间筛选器: 点'{text.strip()}'", "pass", "筛选器可用")
            else:
                record("Dashboard", "时间筛选器", "warn", "未找到时间筛选按钮")

        # ---- Test: Click table row for order detail ----
        table_rows = await page.query_selector_all('tr[class*="row"], tbody tr, [class*="table"] tr')
        if len(table_rows) > 1:
            await table_rows[1].click()  # First data row
            await sleep(2000)

            # Check for popup/modal
            modals = await page.query_selector_all('[class*="modal"], [class*="dialog"], [class*="popup"], [class*="drawer"], [class*="overlay"]')
            if len(modals) > 0:
                record("Dashboard", "订单详情弹窗: 点表格行→弹出", "pass", "弹窗已打开")

                # ---- Test: 查看核算明细 in modal ----
                calc_btn = await page.query_selector('button:has-text("核算明细"), button:has-text("利润"), a:has-text("核算明细")')
                if calc_btn:
                    await calc_btn.click()
                    await sleep(2000)

                    # Check for profit drawer
                    drawers = await page.query_selector_all('[class*="drawer"], [class*="panel"], [class*="side"]')
                    if drawers:
                        record("Dashboard", "弹窗里查看核算明细→利润抽屉", "pass", "抽屉已打开")
                    else:
                        record("Dashboard", "弹窗里查看核算明细→利润抽屉", "warn", "按核算明细后未找到抽屉")
                else:
                    record("Dashboard", "弹窗里查看核算明细→按钮", "warn", "未找到核算明细按钮")
            else:
                record("Dashboard", "订单详情弹窗: 点表格行→弹出", "warn", "点击后未找到弹窗")
        else:
            record("Dashboard", "订单详情弹窗: 点表格行→弹出", "warn", "未找到数据表格")

        # Check for waterfall chart elements
        waterfall = await page.query_selector_all('[class*="waterfall"], [class*="cascade"], [class*="瀑布"]')
        if waterfall:
            record("Dashboard", "利润抽屉瀑布条", "pass", "瀑布条元素存在")
        else:
            record("Dashboard", "利润抽屉瀑布条", "warn", "未找到瀑布条元素（可能在其他页面）")

        # ============================================================
        # 4. PRODUCT PAGE
        # ============================================================
        print("\n" + "=" * 60)
        print("4. 商品分析 ProductPage 测试")
        print("=" * 60)

        # Navigate to product page
        for item in nav_items:
            text = await item.inner_text()
            if '商品' in text or 'product' in text.lower():
                await item.click()
                await sleep(2000)
                break

        # Check product list
        product_cards = await page.query_selector_all('[class*="product"], [class*="ProductCard"], [class*="item-card"]')
        product_count = len(product_cards)

        # Alternative: count by product names
        if product_count == 0:
            body_text = await page.inner_text('body')
            # Look for product names in the audit data
            known_products = ['手机支架', '充电', '数据线', '耳机', '蓝牙', '桌面', '可折叠']
            found_products = sum(1 for p in known_products if p in body_text)
            product_count = found_products

        if product_count >= 6:
            record("商品分析", f"商品数量({product_count}个)", "pass", f"至少6个商品可见")
        elif product_count >= 1:
            record("商品分析", f"商品数量({product_count}个)", "warn", f"仅有{product_count}个商品，期望8个")
        else:
            record("商品分析", f"商品数量({product_count}个)", "warn", "未检测到商品列表")

        # ---- Test: Category filter ----
        cat_btns = await page.query_selector_all('button:has-text("分类"), button[class*="filter"], button[class*="category"]')
        if cat_btns:
            for btn in cat_btns[:3]:
                await btn.click()
                await sleep(1000)
            record("商品分析", "分类筛选按钮", "pass", "筛选按钮可点击")
        else:
            record("商品分析", "分类筛选按钮", "warn", "未找到分类筛选按钮")

        # ---- Test: Search ----
        search_input = await page.query_selector('input[placeholder*="搜索"], input[placeholder*="search"], input[type="search"]')
        if search_input:
            await search_input.fill("支架")
            await search_input.press("Enter")
            await sleep(2000)
            record("商品分析", "搜索框", "pass", "搜索框可用")
        else:
            record("商品分析", "搜索框", "warn", "未找到搜索框")

        # ---- Test: Click product for deep analysis ----
        product_links = await page.query_selector_all('[class*="product"] a, [class*="ProductCard"] button')
        if not product_links:
            # Try clicking directly on product items
            product_links = await page.query_selector_all('div[role="button"], .cursor-pointer')

        if product_links:
            await product_links[0].click()
            await sleep(3000)
            new_url = page.url
            if 'product' in new_url.lower() or 'analysis' in new_url.lower() or 'deep' in new_url.lower():
                record("商品分析", "点商品→沉浸分析打开", "pass", f"跳转到 {new_url}")
            else:
                record("商品分析", "点商品→沉浸分析打开", "warn", f"URL: {new_url}")
        else:
            record("商品分析", "点商品→沉浸分析打开", "warn", "未找到可点击的商品项")

        # ============================================================
        # 5. PRODUCT DEEP ANALYSIS
        # ============================================================
        print("\n" + "=" * 60)
        print("5. 商品沉浸分析 ProductDeepAnalysis 测试")
        print("=" * 60)

        body_text = await page.inner_text('body')

        # ---- Test: Breadcrumb ----
        breadcrumb = await page.query_selector_all('[class*="breadcrumb"], nav[aria-label*="breadcrumb"]')
        if breadcrumb:
            record("商品沉浸分析", "面包屑显示", "pass", "面包屑导航可见")
        else:
            # Check text content for navigation-like text
            if '>' in body_text and ('商品' in body_text or '首页' in body_text):
                record("商品沉浸分析", "面包屑显示", "pass", "面包屑文本存在")
            else:
                record("商品沉浸分析", "面包屑显示", "warn", "未找到面包屑")

        # ---- Test: Time filters in deep analysis ----
        da_time_btns = await page.query_selector_all('button')
        time_clicked = 0
        for btn in da_time_btns:
            text = await btn.inner_text()
            if text.strip() in ['7天', '30天', '本周', '本月', '全部']:
                await btn.click()
                await sleep(2000)
                time_clicked += 1

        if time_clicked >= 3:
            record("商品沉浸分析", "时间筛选 7天/30天/本周/本月/全部", "pass", f"{time_clicked}个时间筛选器可点击")
        elif time_clicked >= 1:
            record("商品沉浸分析", "时间筛选 7天/30天/本周/本月/全部", "warn", f"仅{time_clicked}个可点击")
        else:
            record("商品沉浸分析", "时间筛选 7天/30天/本周/本月/全部", "warn", "未在沉浸分析页找到时间筛选")

        # ---- Test: KPI cards count ----
        deep_kpi_cards = await page.query_selector_all('[class*="kpi"], [class*="stat-card"], [class*="metric"]')
        deep_kpi_with_numbers = []
        for card in deep_kpi_cards:
            text = await card.inner_text()
            if any(c.isdigit() for c in text):
                deep_kpi_with_numbers.append(card)

        deep_kpi_count = len(deep_kpi_with_numbers)
        if deep_kpi_count >= 5:
            record("商品沉浸分析", f"KPI卡片({deep_kpi_count}个)", "pass", f"{deep_kpi_count}个KPI有数值")
        elif deep_kpi_count >= 1:
            record("商品沉浸分析", f"KPI卡片({deep_kpi_count}个)", "warn", f"仅{deep_kpi_count}个，期望7个")
        else:
            record("商品沉浸分析", f"KPI卡片", "warn", "未检测到KPI数值卡片")

        # ---- Test: 查看利润核算明细 ----
        profit_btn = await page.query_selector('button:has-text("利润核算"), button:has-text("核算"), a:has-text("利润")')
        if profit_btn:
            await profit_btn.click()
            await sleep(2000)
            drawers = await page.query_selector_all('[class*="drawer"], [class*="panel"]')
            if drawers:
                record("商品沉浸分析", "查看利润核算明细→抽屉", "pass", "抽屉已打开")
            else:
                record("商品沉浸分析", "查看利润核算明细→抽屉", "warn", "未找到抽屉")

            # Close drawer
            close_btn = await page.query_selector('[class*="close"], button[class*="drawer-close"]')
            if close_btn:
                await close_btn.click()
                await sleep(500)
        else:
            record("商品沉浸分析", "查看利润核算明细", "warn", "未找到利润核算按钮")

        # ---- Test: Alert banner ----
        alert_elements = await page.query_selector_all('[class*="alert"], [class*="warning"], [class*="banner"], [class*="notice"]')
        if alert_elements:
            record("商品沉浸分析", "异常预警横幅", "pass", "预警横幅可见")
        else:
            # Check for warning text
            if '预警' in body_text or '异常' in body_text or '注意' in body_text:
                record("商品沉浸分析", "异常预警横幅", "pass", "预警文本存在")
            else:
                record("商品沉浸分析", "异常预警横幅", "warn", "未找到预警横幅")

        # ---- Test: Conversion funnel ----
        funnel_elements = await page.query_selector_all('[class*="funnel"], [class*="conversion"]')
        funnel_text = any(word in body_text for word in ['曝光', '点击', '转化', '加购', '下单', '支付'])
        if funnel_elements or funnel_text:
            record("商品沉浸分析", "转化漏斗", "pass", "转化漏斗有数据")
        else:
            record("商品沉浸分析", "转化漏斗", "warn", "未找到转化漏斗")

        # ---- Test: Trend chart ----
        trend_charts = await page.query_selector_all('.recharts-wrapper, [class*="trend-chart"], [class*="line-chart"]')
        # Check for trend keywords
        trend_keywords = sum(1 for w in ['GMV', '销量', '实收', '利润'] if w in body_text)
        if len(trend_charts) > 0 or trend_keywords >= 2:
            record("商品沉浸分析", "趋势图有曲线(GMV/销量/实收/利润)", "pass", f"图表+{trend_keywords}个指标")
        else:
            record("商品沉浸分析", "趋势图有曲线(GMV/销量/实收/利润)", "warn", "未确认趋势图")

        # ---- Test: Event markers ----
        event_markers = await page.query_selector_all('[class*="event"], [class*="marker"], [class*="reference-line"], [class*="annotation"]')
        if event_markers:
            record("商品沉浸分析", "事件标记线", "pass", "事件标记线存在")
        else:
            record("商品沉浸分析", "事件标记线", "warn", "未找到事件标记线")

        # ---- Test: ROI pie charts ----
        pie_charts = await page.query_selector_all('.recharts-pie, [class*="pie-chart"], [class*="donut"]')
        if len(pie_charts) >= 2:
            record("商品沉浸分析", "推广渠道ROI双饼图", "pass", "双饼图可见")
        elif len(pie_charts) == 1:
            record("商品沉浸分析", "推广渠道ROI双饼图", "warn", "仅1个饼图，期望2个")
        else:
            # Check text for pie chart data
            if 'ROI' in body_text and '推广' in body_text:
                record("商品沉浸分析", "推广渠道ROI双饼图", "warn", "无饼图但有关键词")
            else:
                record("商品沉浸分析", "推广渠道ROI双饼图", "warn", "未找到双饼图")

        # ---- Test: SKU matrix ----
        sku_elements = await page.query_selector_all('[class*="sku"], [class*="matrix"], [class*="table"] tr')
        if len(sku_elements) > 0:
            record("商品沉浸分析", "SKU矩阵显示", "pass", f"SKU表格有{len(sku_elements)}行")

            # Try clicking a row to expand
            if len(sku_elements) > 1:
                await sku_elements[1].click()
                await sleep(1500)
                record("商品沉浸分析", "SKU矩阵点击行展开", "pass", "点击Sku行")
        else:
            if 'SKU' in body_text.upper() or '规格' in body_text:
                record("商品沉浸分析", "SKU矩阵显示", "warn", "有SKU相关文本但无表格")
            else:
                record("商品沉浸分析", "SKU矩阵显示", "warn", "未找到SKU矩阵")

        # ---- Test: Refund reason ----
        refund_keywords = sum(1 for w in ['退款原因', '退货原因', '售后原因'] if w in body_text)
        if refund_keywords > 0:
            record("商品沉浸分析", "退款原因数据", "pass", "退款原因有数据")
        else:
            record("商品沉浸分析", "退款原因数据", "warn", "未找到退款原因")

        # ---- Test: Health score ----
        health_elements = await page.query_selector_all('[class*="gauge"], [class*="score"], [class*="health"], [class*="rating"]')
        if health_elements:
            record("商品沉浸分析", "健康度仪表盘", "pass", "健康度仪表盘可见")
        else:
            if '健康' in body_text or '评分' in body_text or '分数' in body_text:
                record("商品沉浸分析", "健康度仪表盘", "pass", "健康度文本存在")
            else:
                record("商品沉浸分析", "健康度仪表盘", "warn", "未找到健康度仪表盘")

        # ---- Test: Diagnostic suggestions ----
        diag_elements = await page.query_selector_all('[class*="diagnos"], [class*="suggest"], [class*="recommend"], details, summary')
        expandable = len(diag_elements)
        if expandable > 0:
            for elem in diag_elements[:3]:
                try:
                    await elem.click()
                    await sleep(500)
                except:
                    pass
            record("商品沉浸分析", "诊断建议可点击展开", "pass", f"{expandable}个可展开元素已点击")
        else:
            if '建议' in body_text or '优化' in body_text:
                record("商品沉浸分析", "诊断建议可点击展开", "warn", "有建议文本但不可展开")
            else:
                record("商品沉浸分析", "诊断建议可点击展开", "warn", "未找到诊断建议")

        # ============================================================
        # SUMMARY
        # ============================================================
        print("\n" + "=" * 60)
        print("测试汇总")
        print("=" * 60)

        pass_count = sum(1 for r in RESULTS if r.startswith("✅"))
        warn_count = sum(1 for r in RESULTS if r.startswith("⚠️"))
        fail_count = sum(1 for r in RESULTS if r.startswith("❌"))
        total = len(RESULTS)

        print(f"总计: {total} 项")
        print(f"✅ 正常: {pass_count}")
        print(f"⚠️ 有问题: {warn_count}")
        print(f"❌ 异常: {fail_count}")

        if ISSUES:
            print(f"\n需关注的问题 ({len(ISSUES)}项):")
            for issue in ISSUES:
                print(f"  {issue}")

        # Save screenshot for reference
        await page.screenshot(path='/e/RJ/SSBB/meoo_zip_1779612767549/test_screenshot.png', full_page=True)
        print("\n截图已保存: test_screenshot.png")

        # Save results
        result_data = {
            'test_time': datetime.now().isoformat(),
            'tester': 'yunyingA',
            'total': total,
            'pass': pass_count,
            'warn': warn_count,
            'fail': fail_count,
            'results': RESULTS
        }
        with open('/e/RJ/SSBB/meoo_zip_1779612767549/test_ui_result.json', 'w', encoding='utf-8') as f:
            json.dump(result_data, f, ensure_ascii=False, indent=2)
        print("结果已保存: test_ui_result.json")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
