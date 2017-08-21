'use strict';

let Popup = (function() {
    let _steps = [
            "results",
            "incorrect-layout",
            "niche-hunters",
            "tracking-products",
            "track",
            "initial",
            "renew",
            "login"
        ];

    let _mode = null;

    let _subscriptionCheckInterval = null;
    let _itemsTable = null;
    let _productsTable = null;
    let _revenueOption = JSON.parse(localStorage._revenue_option || "null") || "monthly";
    let _revenueOptionvalue = {
        "monthly": 1,
        "daily": 30
    };
    let _curTabId = null;
    let _nicheSearchOptions = {
        bsr: null,
        title: null,
        pages: null,
        price: null,
        revenue: null,
        reviews: null
    };
    let _products = [];
    let _nicheHunters = [];
    
    let _selectedProduct = null;

    let _curStep = JSON.parse(localStorage._curStep || "null") || "results";

    let _background = chrome.extension.getBackgroundPage().Background;

    let $_category = $("#category");
    let $_domain = $("select.domain");

    let _curSortColumn = "bsr";
    let _sortOption = "asc";

    let _nicheHuntersTable = $("table#niche-hunters-table");

    let _globalTimer = null;

    let _validDomains = [
        "amazon.com.au",
        "amazon.ca",
        "amazon.com",
        "amazon.co.uk",
        "amazon.de",
        "amazon.es",
        "amazon.fr",
        "amazon.in",
        "amazon.it",
        // "amazon.co.jp",
    ];
    
    const bsrPagesPath = {
        "Books": {
            "amazon.com.au": "/best-sellers-books-Amazon/zgbs/books/",
            "amazon.ca": "/best-sellers-books-Amazon/zgbs/books/",
            "amazon.com": "/best-sellers-books-Amazon/zgbs/books/",
            "amazon.co.uk": "/best-sellers-books-Amazon/zgbs/books/",
            "amazon.de": "/gp/bestsellers/books/",
            "amazon.es": "/gp/bestsellers/books/",
            "amazon.fr": "/gp/bestsellers/books/",
            "amazon.in": "/gp/bestsellers/books/",
            "amazon.it": "/gp/bestsellers/books/",
            "amazon.co.jp": "/gp/bestsellers/books/"
        },
        "eBooks": {
            "amazon.com.au": "/gp/bestsellers/digital-text/2496751051/ref=zg_bs_nav_kinc_1_kinc",
            "amazon.ca": "/gp/bestsellers/digital-text/2980423011/ref=zg_bs_unv_kinc_2_5783471011_1/",
            "amazon.com": "/Best-Sellers-Kindle-Store-eBooks/zgbs/digital-text/154606011/ref=zg_bs_nav_kstore_1_kstore",
            "amazon.co.uk": "/Best-Sellers-Kindle-Store-eBooks/zgbs/digital-text/341689031/ref=zg_bs_nav_kinc_1_kinc",
            "amazon.de": "/gp/bestsellers/digital-text/530886031/ref=zg_bs_nav_kinc_1_kinc",
            "amazon.es": "/gp/bestsellers/digital-text/827231031/ref=zg_bs_unv_kinc_2_1335544031_1",
            "amazon.fr": "/gp/bestsellers/digital-text/695398031/ref=zg_bs_unv_kinc_2_891039031_1",
            "amazon.in": "/gp/bestsellers/digital-text/1634753031/ref=zg_bs_unv_kinc_2_1637004031_1",
            "amazon.it": "/gp/bestsellers/digital-text/827182031/ref=zg_bs_unv_kinc_2_1338379031_1",
            "amazon.co.jp": "/gp/bestsellers/digital-text/2275256051/ref=zg_bs_unv_kinc_2_2292699051_1"
        }
    };

    /**
     * Get the BSR based search result page for the given/selected domain and category.
     * @return {string}
     */
    const getSearchUrl = () => {
        let state = _background.get();
        let bsrPath = bsrPagesPath[state.category][state.domain];
        let keyword = (state.category == "eBooks") ? "digital-text" : "books";

        return {
            pattern: `*://www.${state.domain}/*/${keyword}/*`,
            https: `https://www.${state.domain}${bsrPath}`,
            http: `http://www.${state.domain}${bsrPath}`
        };
    }

    const getMode = () => {
        return _mode;
    }

    /**
     * Truncate string with a specific length. In case of longer than the length, truncate with suffix "..."
     * @param {string} str 
     * @param {number} length 
     * @return {string}
     */
    const truncateString = (str, length) => {
        return (str.length > length) ? str.substr(0, length - 3) + "..." : str;
    }

    /**
     * Get the corresponding value for selected column in products table.
     * @param {object} obj 
     * @param {string} colName 
     */
    const getCompareValue = (obj, colName) => {
        switch(colName) {
            case "bsr":
            case "title":
            case "pages":
            case "price":
            case "reviews":
                return obj[colName];

            case "monthly_rev":
                return Number(Math.round(_background.estimation(obj.bsr) * obj.price));

            case "estSale":
                return Number(Math.round(_background.estimation(obj.bsr)));

            default:
                return 1;
        }
    }

    /**
     * Draw Table with products scraped from Amazon across domains and categories considered in the chrome extension.
     * @param {boolean} forceFlag
     * @return {void}
     */
    let drawTable = function(forceFlag) {
        if (!_curTabId) {
            return false;
        }
        chrome.tabs.sendMessage(_curTabId, {
            from: "popup",
            action: "get_data",
            category: $_category.val()
        }, (response) => {
            if (!response) {
                return false;
            } else {
                    let products = response.products,
                    trackings = _background.items(),
                    index = 1,
                    $tbody = $("table#results-table tbody");

                $(".tracking-count").text(trackings.length);

                if (products.length == _products.length && !forceFlag) {
                    return false;
                } else {
                    $tbody.children().remove();

                    products = products.sort((a, b) => {
                        let aV = getCompareValue(a, _curSortColumn);
                        let bV = getCompareValue(b, _curSortColumn);

                        aV = (parseInt(aV) == NaN) ? (aV ? aV: -1) : parseInt(aV);
                        bV = (parseInt(bV) == NaN) ? (bV ? bV: -1) : parseInt(bV);
                        
                        if (typeof aV == "string") {
                            let flag = (_sortOption === "asc") ? 1 : -1;

                            if (aV > bV) {
                                return -1 * flag;
                            } else if (aV < bV) {
                                return 1 * flag;
                            } else {
                                return 0;
                            }
                        } else {
                            return (_sortOption == "asc") ? (aV - bV) : (bV - aV);
                        }
                    });

                    _products = products.concat();
                    drawNicheHunterTable();

                    let bsrSum = 0,
                        pageSum = 0,
                        reviewSum = 0,
                        priceSum = 0.0,
                        estSaleSum = 0,
                        revenueSum = 0,
                        productsCount = products.length;

                    for (let i = 0; i < productsCount; i ++) {
                        _products[i].index = i;
                        let found = trackings.filter(item => item.product.asin == products[i].asin);
                        let $record = $("<tr/>");

                        if (found.length > 0) {
                            $record.addClass("tracking").attr({"title": "Watching"});
                        }
                        
                        $record.append(
                            $("<td/>").append(
                                $("<a/>").attr({
                                    title: "Open this product in new tab",
                                    href: products[i].url,
                                    target: "_blank"
                                }).text(i + 1)
                            ));
                        $record.append($("<td/>").append($("<a/>").addClass("track-link").attr({"data-index": i}).text(truncateString(products[i].title, 30)).attr({title: "Track : " + products[i].title})));
                        if (found.length > 0) {
                            $record.append($("<td/>").append(
                                $(`<a class='untrack-product' title='Untrack this title' data-index='${i}' data-id='${found[0].product.id}'>UnTrack</a>`)
                            ));
                        } else {
                            $record.append($("<td/>").append(
                                $(`<a class='track-product' title='Track this title' data-index='${i}'>Track</a>`)
                            ));
                        }

                        $record.append(
                            $("<td/>").text(Number(products[i].bsr).toLocaleString())
                        );
                        bsrSum += (parseInt(products[i].bsr) | 0);

                        $record.append($("<td/>").text(products[i].pages));
                        pageSum += (parseInt(products[i].pages) || 0);
                        $record.append($("<td/>").text(products[i].currency + products[i].price));
                        priceSum += (parseFloat(products[i].price) || 0.0);
                        _products[i].estSale = parseInt(_background.estimation(products[i].bsr));
                        $record.append($("<td/>").text(Number(parseInt(_background.estimation(products[i].bsr)  / _revenueOptionvalue[_revenueOption])).toLocaleString()));
                        estSaleSum += (parseInt(parseInt(_background.estimation(products[i].bsr)  / _revenueOptionvalue[_revenueOption])) | 0);
                        $record.append($("<td/>").text(products[i].currency + Number(parseInt(_background.estimation(products[i].bsr) * parseFloat(products[i].price) / _revenueOptionvalue[_revenueOption])).toLocaleString()));
                        revenueSum += (parseInt(parseInt(_background.estimation(products[i].bsr) * products[i].price / _revenueOptionvalue[_revenueOption])) | 0);
                        $record.append($("<td/>").text(Number(products[i].reviews || 0).toLocaleString()));
                        reviewSum += (parseInt(products[i].reviews) | 0);

                        $record.appendTo($tbody);
                    }

                    $("table td[data-prop='bsr']").text(parseInt(bsrSum / productsCount) || 0);
                    $("table td[data-prop='pages']").text(parseInt(pageSum / productsCount) || 0);
                    $("table td[data-prop='reviews']").text(Number(parseInt(reviewSum / productsCount) || 0).toLocaleString());
                    if (products.length > 0) {
                        $("table td[data-prop='price']").text(products[0].currency + Math.round(priceSum / productsCount * 100) / 100);
                        $("table td[data-prop='revenue']").text(products[0].currency + Number(parseInt(revenueSum / productsCount)).toLocaleString());
                    } else {
                        $("table td[data-prop='price']").text(0);
                        $("table td[data-prop='revenue']").text(0);
                    }
                    
                    $("table td[data-prop='estSales']").text(Number(parseInt(estSaleSum / productsCount) || 0).toLocaleString());
                }

                if (response.started && products.length == 0) {
                    showLoading();
                } else {
                    hideLoading();
                }
            }
        });
    };

    /**
     * Check a op b;
     * @param {number} a 
     * @param {number} op 
     * @param {string} b 
     * @return {boolean}
     */
    const check = (a, op, b) => {
        a = parseFloat(a);
        b = parseFloat(b);
        if (a == NaN || b == NaN) {
            return false;
        }

        switch(op) {
            case "=":
                return a == b;
                
            case ">":
                return a > b;

            case "<":
                return a < b;
        }
    }

    /**
     * Filter function for niche hunter search.
     * @param {object} product 
     * @param {array} options 
     * @return {boolean}
     */
    const checkNicheHunterSearchOptions = (product, options) => {
        for (let i = 0; i < options.length; i ++) {
            let opIndex = null;
            let operators = ["=", ">", "<"];
            let key, op, value = null;
            for (let j = 0; j < operators.length; j ++) {
                if (options[i].indexOf(operators[j]) > -1) {
                    opIndex = j;
                    op = operators[opIndex];
                    break;
                }
            }

            if (!op) {
                return false;
            }

            [key, value] = options[i].split(op);

            switch(key) {
                case "t":
                case "title":
                    if (product.title.toLowerCase().indexOf(value.toLowerCase()) == -1) {
                        return false;
                    }
                    break;
                
                case "p":
                case "price":
                    if (!check(product.price, op, value)) {
                        return false;
                    }
                    break;

                case "pg":
                case "pages":
                case "page":
                    if (!check(product.pages, op, value)) {
                        return false;
                    }
                    break;

                case "r":
                case "reviews":
                case "review":
                    if (!check(product.reviews, op, value)) {
                        return false;
                    }
                    break;

                case "ms":
                case "monthly Units Sold":
                    if (!check(parseInt(_background.estimation(product.bsr)), op, value)) {
                        return false;
                    }
                    break;

                case "ds":
                case "daily Units Sold":
                    if (!check(parseInt(_background.estimation(product.bsr) / 30), op, value)) {
                        return false;
                    }
                    break;

                case "mr":
                case "monthly revenue":
                    if (!check(parseInt(_background.estimation(product.bsr) * product.price), op, value)) {
                        return false;
                    }
                    break;

                case "dr":
                case "daily revenue":
                    if (!check(parseInt(_background.estimation(product.bsr) * product.price / 30), op, value)) {
                        return false;
                    }
                    break;
                    
                case "k":
                case "keyword":
                case "keywords":
                    let flag = false;
                    let keywords = (product.keywords || "something new").split(",");
                    for (let j = 0; j < keywords.length; j ++) {
                        if (keywords[j].toLowerCase().indexOf(value.toLowerCase()) > -1) {
                            flag = true;
                            break;
                        }
                    }
                    if (!flag) {
                        return false;
                    }
                    break;
            }
        }
        return true;
    }

    /**
     * Render Niche Hunter Products table whenever parameter string changes.
     * @param {string} paramString 
     * @return {void}
     */
    let drawNicheHunterTable = (paramString) => {
        if (paramString == undefined) {
            paramString = $("#niche-hunters-search-param").val();
        }

        let products = _products.concat();
        let searchOptions = null;
        let trackings = _background.items();
        let $tbody = _nicheHuntersTable.find("tbody");
        let params = paramString ? paramString.split("&") : [];
        let nicheHunterAvgMonthlyRevenue = $(".footer-avg-monthly-revenu");
        let monthlyRevenueSum = 0;

        products = products.filter((product) => {
            if (!paramString) {
                return true;
            } else {
                return checkNicheHunterSearchOptions(product, params);
            }
        });
        products = products.sort((a, b) => {
            return a.bsr - b.bsr;
        });

        $tbody.children().remove();

        for (let i = 0; i < products.length; i ++) {
            let found = trackings.filter(item => item.product.asin == products[i].asin);
            let $record = $("<tr/>");

            if (found.length > 0) {
                $record.addClass("tracking").attr({"title": "Watching"});
            }
            
            // $record.append($("<td/>").text(products[i].bsr));
            // $record.append($("<td/>").append($("<span/>").text(truncateString(products[i].title, 30)).attr({title: "Track : " + products[i].title})));
            // $record.append($("<td/>").text(products[i].pages));
            // $record.append($("<td/>").text(products[i].currency + products[i].price));
            // $record.append($("<td/>").text(Number(parseInt(_background.estimation(products[i].bsr)  / _revenueOptionvalue[_revenueOption])).toLocaleString()));
            // $record.append($("<td/>").text(products[i].currency + Number(parseInt(_background.estimation(products[i].bsr) * products[i].price / _revenueOptionvalue[_revenueOption])).toLocaleString()));
            // $record.append($("<td/>").text(Number(products[i].reviews).toLocaleString()));

            $record.append(
                $("<td/>").append(
                    $("<a/>").attr({
                        href: products[i].url,
                        title: truncateString(products[i].title, 20),
                        target: "_blank"
                    }).text(i + 1)
                ),
                $("<td/>").append(
                    $(`<a title="${products[i].title}" class="track-link" data-index="${products[i].index}">${truncateString(products[i].title, 15)}</a>`)
                )
            );
            
            if (found.length > 0) {
                $record.append(
                    $("<td/>").html(
                        `<a data-from="niche" class="untrack-product" data-id="${found[0].product.id}">UnTrack</a>`
                    )
                )
            } else {
                $record.append(
                    $("<td/>").html(
                        `<a data-from="niche" class="track-product" data-index="${products[i].index}">Track</a>`
                    )
                )
            }
            let estSale = parseInt(_background.estimation(products[i].bsr));
            $record.append(
                $("<td/>").text(Number(products[i].bsr).toLocaleString()),
                $("<td/>").text(products[i].pages),
                $("<td/>").text(products[i].reviews),
                $("<td/>").text(products[i].currency + products[i].price),
                $("<td/>").text(Number(estSale).toLocaleString()),
                $("<td/>").text(products[i].currency + Number(parseInt(estSale * products[i].price)).toLocaleString())
            );

            monthlyRevenueSum += parseInt(estSale * products[i].price);

            $record.appendTo($tbody);
        }

        _nicheHunters = products;

        nicheHunterAvgMonthlyRevenue.text((products.length > 0)
            ? products[0].currency + Number(parseInt(monthlyRevenueSum / products.length)).toLocaleString()
            : 0);
    }

    /**
     * Draw change history chart for a given product being tracked by user.
     * @param {number} productID 
     * @param {object} product
     * @return {void}
     */
    const drawChart = (productID, product) => {
        _background.histories(productID, product, (response) => {
            let revenueData = [];
            let bsrData = [];
            let xAxisData = [];
            let graphContainer = document.getElementById("graph-container");
            let daysTracking = 0;
            let dailyRevenueSum = 0;
            let $avgDailyRevenue = $(".avg-daily-revinue-estimation");
            let avgBSR = 0;

            for (let i = 0; i < response.histories.length; i ++) {
                revenueData.push([response.histories[i].updated_at, parseInt(response.histories[i].monthly_rev/* / 30*/)]);
                bsrData.push([response.histories[i].updated_at, parseInt(response.histories[i].bsr)]);
                xAxisData.push(new Date(response.histories[i].updated_at).toLocaleDateString());
                daysTracking++;
                dailyRevenueSum += parseInt(response.histories[i].monthly_rev / 30);
                avgBSR += parseInt(response.histories[i].bsr);
            }

            let lastHistory = response.product.histories[response.product.histories.length - 1];
            let first = response.histories[0].updated_at;
            let tmp = parseInt((new Date() - new Date(first)) / (24 * 3600 * 1000));
            $avgDailyRevenue.text(lastHistory.currency + Number(Math.round(dailyRevenueSum / daysTracking)).toLocaleString());
            $("#product-monthly_revenue").text("#" + Number(Math.round(dailyRevenueSum / daysTracking * 30).toLocaleString()));
            $(".footer-tracking-days").text(tmp);
            $(".footer-avg-bsr").text("#" + Number(Math.round(avgBSR / daysTracking)).toLocaleString());

            Highcharts.chart('graph-container', {
                chart: {
                    zoomType: 'x'
                },
                xAxis: {
                    type: 'datetime',
                    dateTimeLabelFormats: {
                        day: '%b %e'    //ex- 01 Jan 2016
                    },
                    categories: xAxisData
                },
                title: {
                    text: "Monthly Revenue Chart"
                },
                yAxis: {
                    title: "Monthly Revenue & BSR"
                },
                series: [
                    {
                        name: "Revenue",
                        data: revenueData,
                        tooltip: {
                            valuePrefix: "$"
                        }
                    },
                    {
                        name: "BSR",
                        data: bsrData,
                        tooltip: {
                            valuePrefix: "#"
                        }
                    }
                ],
                    

            });
        }, (response) => {
            //  To do in failure.
            if (response.status == false && response.message == "Your token was expired.") {
                goTo("login");
            }
        })
    }

    let downloadPlaintext = function(data, filename) {
        // let blob = new Blob([data], { type: "text/csv;charset=unicode;base64;" })

        let el = document.createElement("a")
        // el.href = URL.createObjectURL(blob);
        el.href = 'data:text/csv;charset=utf-8,%EF%BB%BF'+encodeURIComponent(data);
        el.download = filename
        document.body.appendChild(el)
        el.click()
        document.body.removeChild(el)
    }

    /**
     * Exporting products to CSV file.
     * @param {array} products
     */
    const downloadProductsToCSV = (products) => {
        let toLine = arr => arr.map(x => `"${(x + "").replace(/"/g, '""')}"`).join(",");
        let header = ["title", "BSR", "pages", "price", "Units Sold", "Revenue", "reviews", "url"];
        let category = $_category.val();
        // let products = _background.get().products;
        let index = 1;
        let data = products.map(p => toLine([
                p.title,
                Number(p.bsr).toLocaleString(),
                p.pages || "",
                p.currency + p.price,
                Number(parseInt(_background.estimation(p.bsr))).toLocaleString(),
                p.currency + Number(parseInt(_background.estimation(p.bsr) * p.price)).toLocaleString(),
                Number(p.reviews).toLocaleString(),
                p.url
        ]));
        
        data.unshift(toLine(header))

        downloadPlaintext(data.join("\n"), `${category}-${new Date().toISOString()}.csv`)
    }

    const downloadProduct = (p) => {
        downloadProductsToCSV([p]);
    }

    /**
     * Render Tracking product view with specific/selected product. In this view, user will be able to watch/unwatch a product or see chart of the product details.
     * @param {object} product 
     * @return {void}
     */
    const renderTrackForm = (product, flag) => {
        let $img = $("#product-image"),
            $graph = $("#graph-container"),
            $title = $("#product-title"),
            $bsr = $("#product-bsr"),
            $estSales = $("#product-estSales"),
            $isbn = $("#product-isbn"),
            $price = $("#product-price"),
            $reviews = $("#product-reviews"),
            $revenue = $("#product-monthly-revenue"),
            $pages = $("#product-pages"),
            $asin = $("#product-asin");

        $pages.text(product.pages);

        if (flag) {
            let lastHistory = product.histories[product.histories.length - 1];
            product.price = lastHistory.price;
            product.reviews = lastHistory.reviews;
            product.bsr = lastHistory.bsr;
            product.currency = lastHistory.currency;
            $pages.text(lastHistory.pages);
        }
        
        $img[0].src = product.img;
        $title.text(product.title);
        $asin.text(product.asin);
        $price.text(product.currency + product.price);
        $reviews.text(Number(product.reviews).toLocaleString());
        $bsr.text( "#" + Number(product.bsr).toLocaleString());
        $isbn.text(product.isbn);
        product.estSale = parseInt(_background.estimation(product.bsr));
        // $revenue.text(product.currency + Number(parseInt((parseFloat(product.price || 1) * parseInt(product.estSale || 1)))).toLocaleString());
        $revenue.text(product.currency + Number(parseInt(_background.estimation(product.bsr) * parseFloat(product.price))).toLocaleString());
        
        $estSales.text(Number(product.estSale).toLocaleString());
        $(".footer-avg-bsr").text("-")

        let trackingProducts = _background.items().filter(item => item.product.asin == product.asin);
        let trackButton = document.getElementById("product-track");
        if (trackingProducts.length > 0) {
            let userInfo = JSON.parse(localStorage._user || "{}");
            
            if (userInfo.id == trackingProducts[0].tracked_by) {
                $(".footer-tracking-days-container").attr({
                    title: ""
                });
            } else {
                $(".footer-tracking-days-container").attr({
                    title: "Tracked by System."
                });
            }
            
            trackButton.setAttribute("data-id", trackingProducts[0].product.id);
            trackButton.setAttribute("data-action", "untrack");
            trackButton.textContent = "Untrack this title";
            trackButton.className = "btn btn-danger";
            $(".track-detail-info").show();

            drawChart(trackingProducts[0].product.id, product);
        } else {
            trackButton.setAttribute("data-id", null);
            trackButton.setAttribute("data-action", "track");
            trackButton.textContent = "Track this title";
            trackButton.className = "btn btn-primary";
            $(".track-detail-info").hide();
            $("#graph-container").children().remove();
            $("#graph-container").append($(`<h4 style="text-align:center;padding-top:140px;">Tracking is not enabled for this title yet.</h4>`));
        }
    }


    const getToken = () => {
        return JSON.parse(localStorage._token || "null");
    };

    const getUser = () => {
        return JSON.parse(localStorage._user || "{}");
    };

    const initializeComponents = () => {
        let settings = _background.get();
        $_category.val(settings.category || "eBooks");
        $_domain.val(settings.domain || "amazon.com");
    }

    /**
     * Switch to the specific step such as register, login, results and tracking.
     * @param {string} step 
     */
    const goTo = (step) => {
        let userInfo = getUser();

        if ((userInfo.membership_tier == "t" || userInfo.membership_tier == "l" || userInfo.membership_tier == "e") && step == "niche-hunters") {
            alert("Your membership can't visit the Niche Hunters.");
            return false;
        }
        _steps.forEach(function(val) {
            if (step == val) {
                $("#" + val).show();
                if (["track", "tracking-products", "niche-hunters", "renew", "incorrect-layout"].indexOf(step) == -1) {
                    _curStep = step;
                    _background.step(step);
                }
                
                if (step == "login") {
                    let credential = _background.credentials();
                    $("#login-email").val(credential.email);
                    $("#login-password").val(credential.password);
                }
            } else {
                $("#" + val).hide();
            }
        });

        if (step == "results") {
            if (userInfo && userInfo.membership_tier == "e") {
                goTo("renew");
            } else {
                drawTable(true);
            }
        }

        switch(step) {
            case "login":
            case "initial":
                $(".mode-3").hide();
                $(".mode-2").hide();
                $(".mode-4").hide();
                $(".mode-5").hide();
                $(".mode-1").show();
                break;

            case "incorrect-layout":
                $(".mode-3").hide();
                $(".mode-2").hide();
                $(".mode-4").hide();
                $(".mode-1").hide();
                $(".mode-5").hide();
                break;

            case "tracking-products":
                $(".mode-3").hide();
                $(".mode-2").hide();
                $(".mode-4").hide();
                $(".mode-1").hide();
                $(".mode-5").show();
                break;

            case "results":
                $(".mode-3").hide();
                $(".mode-1").hide();
                $(".mode-4").hide();
                $(".mode-5").hide();
                $(".mode-2").show();
                if (_background.started() && _background.get().products.length < 21) {
                    showLoading();
                }
                break;

            case "niche-hunters":
                $(".mode-3").hide();
                $(".mode-1").hide();
                $(".mode-2").hide();
                $(".mode-5").hide();
                $(".mode-4").show();
                break;

            case "track":
                $(".mode-1").hide();
                $(".mode-2").hide();
                $(".mode-4").hide();
                $(".mode-5").hide();
                $(".mode-3").show();
                break;
        }
    };

    /**
     * Set token / user via Background methods into local storage.
     * @param {string} token 
     * @param {object} user 
     */
    const setToken = function(token, user) {
        localStorage._token = JSON.stringify(token);
        localStorage._user = JSON.stringify(user);
    };

    /**
     * Event handler for control buttons placed on popup view. With the buttons, user should be able to switch to other views.
     * @param {object} event 
     */
    const controlButtonHandler = function(event) {
        event.preventDefault();

        if (event.target.getAttribute('data-target')) {
            if (event.target.getAttribute('data-action') === "register") {
                _background.register($("#username").val(), $("#email").val(), $("#password").val(), function(response) {
                    if (response.status) {
                        setToken(response.token, response.user);
                        goTo(event.target.getAttribute('data-target'));
                    }
                });
            } else if (event.target.getAttribute('data-action') === "login") {
                _background.login($("#login-email").val(), $("#login-password").val(), (response) => {
                    if (response.status) {
                        if (response.user.membership_tier === "e") {
                            $("#renew .main-nav-link").hide();
                            goTo("renew");
                        } else {
                            setToken(response.token, response.user);
                            $(".login-error-msg").hide();
                            $(".user-name").text(response.user.name);
                            updateTable();
                            goTo(event.target.getAttribute('data-target'));

                            if (!getMode()) {
                                chrome.tabs.create({url: getSearchUrl().https});
                            }
                            else if (getMode() == "individual") {
                                _background.updateSamples((samples) => {
                                    _selectedProduct.estSale = parseInt(_background.estimation(_selectedProduct.bsr));
                                    renderTrackForm(_selectedProduct);
                                    goTo("track");
                                }, (response) => {
                                    //  To do in failure.
                                    if (response.status == false && response.message == "Your token was expired.") {
                                        goTo("login");
                                    }
                                });
                            }
                        }
                    } else {
                        $(".login-error-msg").show();
                    }
                }, (response) => {
                    $(".login-error-msg").show();
                });
            } else if (event.target.getAttribute('data-action') === "logout") {
                localStorage._token = JSON.stringify(null);
                goTo(event.target.getAttribute('data-target'));
            } else {
                goTo(event.target.getAttribute('data-target'));
            }
        } else {
            if (event.target.getAttribute('data-action') === "done") {
            }
        }
    };

    const showLoading = () => {
        $("#lading-mask").show();
    }

    const hideLoading = () => {
        $("#lading-mask").hide();
    }

    /**
     * Initialize Events for components.
     */
    const initEvents = () => {
        $("button.step-control-button").click(controlButtonHandler);
        $("button#product-track").click((event) => {
            event.preventDefault();
            switch (event.target.getAttribute('data-action')) {
                case "track":
                    _background.track(_selectedProduct, (response) => {
                        console.log(response);
                        event.target.setAttribute("data-action", "untrack");
                        event.target.setAttribute("data-id", response.product.id);
                        event.target.textContent = "Untrack this title";
                        event.target.className = "btn btn-danger";
                        drawChart(response.product.id);
                    }, (response) => {
                        //  To do in failure.
                        if (response.status == false && response.message == "Your token was expired.") {
                            goTo("login");
                        } else if (response.status == false && response.message == "Your membership was expired.") {
                            localStorage._user = JSON.stringify({});
                            goTo("renew");
                        } else if (response.status == false && response.message) {
                            alert(response.message);
                            goTo("renew");
                        }
                    })
                    break;

                case "untrack":
                    let productID = event.target.getAttribute("data-id");
                    _background.untrack(productID, (response) => {
                        event.target.setAttribute("data-action", "track");
                        event.target.setAttribute("data-id", null);
                        event.target.textContent = "Track this title";
                        event.target.className = "btn btn-primary";
                        $("#graph-container").children().remove();
                        $("#graph-container").append(
                            $(`<h4 style="text-align:center;padding-top:140px;">Tracking is not enabled for this title yet.</h4>`)
                        );
                    }, (response) => {
                        //  To do in failure.
                        if (response.status == false && response.message == "Your token was expired.") {
                            goTo("login");
                        }
                    })
                    break;

                default:
                    console.log("Unknown things occured.");
            }
            // restAPI.
        });

        if (!getToken() || !(getUser() || {}).id) {
            if (!JSON.parse(localStorage._curStep || "null")) {
                _curStep = "initial";
            } else {
                _curStep = "login";
            }
        }
        
        goTo(_curStep);
        if (_background.samples().length == 0) {
            _background.updateSamples(() => {
                initializeComponents();
            }, (response) => {
                //  To do in failure.
                if (response.status == false && response.message == "Your token was expired.") {
                    if (JSON.parse(localStorage._token || "null")) {
                        goTo("login");
                    }
                }
            });
        } else {
            initializeComponents();
        }

        $(document)
        .on("click", ".logout", (event) => {
            _background.logout(() => {
                goTo("login");
            });
        })
        .on("click", "#open-eBooks-url", (event) => {
            chrome.tabs.create({url: getSearchUrl().https});
        })
        .on("click", "a.main-nav-link", (event) => {
            event.preventDefault();
            let targetId = event.target.getAttribute("data-target");
            updateTrackingProductsTable();
            drawNicheHunterTable()
            goTo(targetId);
        })
        .on("click", ".icon-export", (event) => {
            event.preventDefault();
            let from = event.target.getAttribute("data-from");
            let products = null;

            if (from == "results") {
                products = _products.concat();
                downloadProductsToCSV(products);
            } else if (from == "niche-hunter") {
                products = _nicheHunters.concat();
                downloadProductsToCSV(products);
            } else if (from == "track") {
                downloadProduct(_selectedProduct);
            }
        })
        .on("click", "a.track-product", (event) => {
            event.preventDefault();
            let index = event.target.getAttribute("data-index");
            let $record = $(event.target).parents("tr");
            let option = event.target.getAttribute("data-from");
            let product = _products[index];

            _background.track(product, (response) => {
                $record.addClass("tracking");
                $(event.target)
                .attr({
                    "data-id": response.product.id,
                    "title": "Untrack this title."
                })
                .text("UnTrack")
                .removeClass("track-product")
                .addClass("untrack-product");

                let curCount = parseInt(JSON.parse($(".tracking-count").eq(0).text() || "0"));
                curCount++;
                $(".tracking-count").text(curCount);
            }, (response) => {
                //  To do in failure.
                if (response.status == false && response.message == "Your token was expired.") {
                    goTo("login");
                } else if (response.status == false && response.message == "Your membership was expired.") {
                    localStorage._user = JSON.stringify({});
                    goTo("renew");
                } else if (response.status == false && response.message) {
                    alert(response.message);
                    // goTo("renew");
                }
            });
        })
        .on("click", "a.untrack-product", (event) => {
            let id = event.target.getAttribute("data-id");
            let option = event.target.getAttribute("data-from");
            let $record = $(event.target).parents("tr");
            
            _background.untrack(id, (response) => {
                if (option == "tracking-list") {
                    $record.remove();
                } else {
                    $record.removeClass("tracking");
                    $(event.target)
                    .attr({
                        "title": "Track this title."
                    })
                    .text("Track")
                    .addClass("track-product")
                    .removeClass("untrack-product")
                }

                let curCount = parseInt(JSON.parse($(".tracking-count").eq(0).text() || "0"));
                curCount--;
                $(".tracking-count").text(Math.max(curCount, 0));
            }, (response) => {
                //  To do in failure.
                if (response.status == false && response.message == "Your token was expired.") {
                    goTo("login");
                }
            });
        })
        .on("click", "table .view-track", (event) => {
            let index = event.target.getAttribute("data-index");
            let items = _background.items();
            let product = items[index];
            
            _background.item(product.product.id, {}, (response) => {
                debugger;
                product = response.product;
                renderTrackForm(product, true);
                goTo("track");
            }, (response) => {
                //  To do in failure.
                if (response.status == false && response.message == "Your token was expired.") {
                    goTo("login");
                }
            })
        })
        .on("change", "select.domain", (event) => {
            event.preventDefault();

            if (event.target.value == "amazon.com.au") {
                $("#category").children("option.category-books").remove().val("eBooks");
                _background.set({
                    category: "eBooks"
                });
            } else if ($("#category").children("option.category-books").length == 0) {
                $("#category").append($("<option/>").attr({
                    class: "category-books",
                    value: "Books"
                }).text("Books"))
            }

             _background.set({
                domain: event.target.value,
                products: []
            });

            let {pattern, http, https} = getSearchUrl();
            chrome.tabs.create({
                url: http
            }, (tab) => {
                _background.set({
                    curTab: tab.id
                });
            });

            // _background.updateSamples((samples) => {
            //     _background.set({
            //         domain: event.target.value,
            //         products: []
            //     });
            //     _background.started(false);
            //     updateTable();
            // }, (response) => {
            //     //  To do in failure.
            //     if (response.status == false && response.message == "Your token was expired.") {
            //         goTo("login");
            //     }
            // });
        })
        .on("change", "#category", (event) => {
            event.preventDefault();

            _background.set({
                category: event.target.value,
                products: []
            });

            let {pattern, http, https} = getSearchUrl();
            chrome.tabs.create({
                url: http
            }, (tab) => {
                _background.set({
                    curTab: tab.id
                });
            });

            // _background.updateSamples((samples) => {
            //     _background.set({
            //         category: event.target.value,
            //         products: []
            //     });
            //     _background.started(false);

            //     updateTable();
            // }, (response) => {
            //     //  To do in failure.
            //     if (response.status == false && response.message == "Your token was expired.") {
            //         goTo("login");
            //     }
            // });
        })
        .on("change", "#revenue_option", (event) => {
            _revenueOption = event.target.value;
            localStorage._revenue_option = JSON.stringify(_revenueOption);
            drawTable(true);
        })
        .on("click","#results-table th", (event) => {
            let sortTarget = event.target.getAttribute("sort-target");

            if (!sortTarget) {
                return false;
            }

            _curSortColumn = sortTarget;
            let curOption = event.target.getAttribute("sort-option") || "asc";
            _sortOption = ["asc", "desc"].filter(option => option != curOption)[0];
            event.target.setAttribute("sort-option", _sortOption);

            drawTable(true);
        })
        .on("change", "#niche-hunters-search-param", (event) => {
            let paramString = event.target.value;
            drawNicheHunterTable(paramString);
        })
    };

    /**
     * Update tracking products table.
     */
    const updateTrackingProductsTable = () => {
        let items = _background.items();
        let $tableBody = $("table#tracking-products-table tbody");
        $tableBody.children().remove();

        for (let i = 0; i < items.length; i ++) {
            let daysTracking = 0;
            let curProduct = items[i].product;
            let parsedProduct = _products.filter(product => {
                return (product.asin == curProduct.asin)
            });
            
            let first = curProduct.created_at;
            let last = new Date();
            let tmp = parseInt((last - new Date(first)) / (24 * 3600 * 1000));

            if (tmp > 1) {
                daysTracking = tmp;
            }
            tmp = Number(tmp).toLocaleString();
            
            let index = (parsedProduct.length > 0) ? parsedProduct[0].index : null;
            let format = (items[i].product.category_id == 3) ? "eBook" : "Book";
            $tableBody.append(
                $("<tr/>").append(
                    $("<td/>").html(
                        `<a href="${items[i].product.url}" target="_newTab">${i + 1}</a>`
                    ),
                    $("<td/>").html(
                        `<a class="view-track" data-global-index="${index}" data-index="${i}">${truncateString(items[i].product.title, 40)}</a>`
                    ),
                    $("<td/>").text(format),
                    $("<td/>").text(daysTracking),
                    $("<td/>").html(
                        `<a class='view-track' data-global-index='${index}' data-index='${i}'>View</a>`
                    ),
                    $("<td/>").html(
                        `<a class="untrack-product" data-from="tracking-list" data-id="${items[i].product.id}">UnTrack</a>`
                    )
                )
            )
        }
    }

    /**
     * Update products table.
     */
    const updateTable = () => {
        let {pattern, http, https} = getSearchUrl();
        let trackingProducts = _background.items();
        let $trackingCount = $(".tracking-count");

        $trackingCount.text(trackingProducts.length);

        // chrome.tabs.query({url: pattern}, (tabs) => {
        //     if (tabs.length > 0) {
        //         _background.set({
        //             curTab: tabs[0].id
        //         });

        //         _curTabId = tabs[0].id;

        //         chrome.tabs.update(tabs[0].id, {active:true}, () => {
        //             let status = _background.get();
        //             initEvents();
        //         });
        //     } else {
        //         chrome.tabs.create({
        //             url: http
        //         }, (tab) => {
        //             _background.set({
        //                 curTab: tab.id
        //             });
        //         });
        //     }
        // });
    }

    const checkSubscription = () => {
        let userInfo = getUser();
        let token = JSON.parse(localStorage._token || "null");

        if (token && userInfo.email) {
            _background.checkSubscription(userInfo.email, (response) => {
                let user = response.user;
                if (userInfo.updated_at != user.updated_at || userInfo.membership_tier != user.membership_tier) {
                    _curStep = "login";
                    goTo(_curStep);
                    localStorage._user = JSON.stringify({});
                }
            }, () => {
                _curStep = "login";
                goTo(_curStep);
                localStorage._user = JSON.stringify({});
            })
        }
    }

    const isAuthorized = () => {
        let userInfo = getUser();
        let token = JSON.parse(localStorage._token || "null");

        return (
            token &&
            userInfo.membership_tier &&
            userInfo.membership_tier !== "e"
        );
    }

    /**
     * Initializer of this object. In this method, periodic bot to refresh table will be initialized.
     */
    const init = function(tabId, params) {
        let userInfo = getUser();

        if (_background.get().domain == "amazon.com.au") {
            $("#category").children("option.category-books").remove();
            _background.set({
                category: "eBooks"
            });
        }

        // updateTable();
        initEvents();

        if (!params || !params.layout) {
            if (!isAuthorized()) {
                goTo("login");
                $(document)
                .on("keypress", "#login-email", (event) => {
                    if (event.which == 13 || event.keyCode == 13) {
                        if (event.target.value.trim() !== "") {
                            $("#login-password").focus();
                        }
                    }
                })
                .on("keypress", "#login-password", (event) => {
                    if (event.which == 13 || event.keyCode == 13) {
                        if ($("#login-email").val().trim() !== "" && $("#login-password").val().trim() != "") {
                            $("#login-submit").click();
                        }
                    }
                })
            } else {
                goTo("incorrect-layout");
                $(document).on("click", "#open-eBooks-url", (event) => {
                    chrome.tabs.create({url: getSearchUrl().https});
                });
            }
            return false;
        }

        if (!_globalTimer) {
            _globalTimer = window.setInterval(() => {
                drawTable();
            }, 500);
        }

        if (!_subscriptionCheckInterval) {
            _subscriptionCheckInterval = window.setInterval(() => {
                checkSubscription();
            }, 10000);
        }
        drawNicheHunterTable();

        $("table").on("click", "a.track-link", (event => {
            let index = event.target.getAttribute("data-index");
            let product = _products[index];

            _selectedProduct = product;
            renderTrackForm(product);
            goTo("track");
        }));

        $("#revenue_option").val(_revenueOption);
        
        $(document)
        .on("keypress", "#login-email", (event) => {
            if (event.which == 13 || event.keyCode == 13) {
                if (event.target.value.trim() !== "") {
                    $("#login-password").focus();
                }
            }
        })
        .on("keypress", "#login-password", (event) => {
            if (event.which == 13 || event.keyCode == 13) {
                if ($("#login-email").val().trim() !== "" && $("#login-password").val().trim() != "") {
                    $("#login-submit").click();
                }
            }
        })
        .on("click", "#untrack-all", (event) => {
            event.preventDefault();

            let $buttons = $("#tracking-products-table .untrack-product");
            for (let i = 0; i < $buttons.length; i ++) {
                $buttons.eq(i).click();
            }
        });

        _curTabId = tabId;
        _mode = params.mode;
        _selectedProduct = params.product;
        $_domain.val(params.domain);
        $_category.val(params.category);

        _background.set({
            domain: params.domain,
            category: params.category
        });

        if (!isAuthorized()) {
            goTo("login");
        } else {
            $(".user-name").text(userInfo.name);
        
            if (params.mode == "individual") {
                _background.updateSamples((samples) => {
                    _selectedProduct.estSale = parseInt(_background.estimation(_selectedProduct.bsr));
                    renderTrackForm(_selectedProduct);
                    goTo("track");
                }, (response) => {
                    //  To do in failure.
                    if (response.status == false && response.message == "Your token was expired.") {
                        goTo("login");
                    }
                });
            } else if (params.mode == "list") {
                goTo("results");
            } else if (!params.layout) {
                goTo("incorrect-layout");
            }
        }
    };

    const getSelectedProduct = () => {
        return _selectedProduct;
    }

    return {
        init: init,
        domains: _validDomains,
        selected: getSelectedProduct,
        searchURL: getSearchUrl
    };
})();

(function(window, jQuery) {
    const isCorrectUrl = (url) => {
        let loc = new URL(url);
        let wwwPrefix = "www.";
        let domain = (loc.hostname.indexOf(wwwPrefix) > -1) ? loc.host.substr(wwwPrefix.length) : loc.host;

        if (["http:", "https:"].indexOf(loc.protocol) == -1) {
            return false;
        } else if (Popup.domains.indexOf(domain) == -1) {
            return false;
        }
        return true;
    }
    chrome.tabs.query({active: true}, (tabs) => {
        
        if (JSON.parse(localStorage._token || "null") && JSON.parse(localStorage._user || "{}").membership_tier && JSON.parse(localStorage._user || "{}").membership_tier != "e") {
            if (isCorrectUrl(tabs[0].url)) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    from: "popup", 
                    action: "get_data"
                }, (response) => {
                    Popup.init(tabs[0].id, response);
                });
            } else {
                chrome.tabs.create({url: Popup.searchURL().https});
            }
        } else {
            if (isCorrectUrl(tabs[0].url)) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    from: "popup", 
                    action: "get_data"
                }, (response) => {
                    Popup.init(tabs[0].id, response);
                });
            } else {
                Popup.init(tabs[0].id);
            }
        }
    });
})(window, $);