const $ = id => document.getElementById(id);
let lastRows = [];
let chartPoints = [];
let savingsChartPoints = [];

// The model is maintained in UVA. This is the only place where the first-version
// approximation "UVA grows approximately with inflation" is defined.
const UVA_GROWTH_MODEL = {
    fromInflation(monthlyInflation) {
        return monthlyInflation;
    }
};

function n(id) {
    return Number($(id).value) || 0;
}

function money(x, currency = "ARS") {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency,
        maximumFractionDigits: 0
    }).format(x);
}

function num(x) {
    return new Intl.NumberFormat("es-AR", {
        maximumFractionDigits: 2
    }).format(x);
}

function getLoanMode() {
    return document.querySelector('input[name="loanMode"]:checked') ?.value || "balance";
}

function getRateMode() {
    return document.querySelector('input[name="rateMode"]:checked') ?.value || "tea";
}

const NUMERIC_IDS = [
    "cuota", "totalCuotas", "tasa", "saldoUva", "uva",
    "valorOriginalUsd", "dolarOriginal", "financiacion", "plazoOriginal",
    "tasaOriginal", "uvaOriginal", "cuotaOriginal", "uvaActualOriginal",
    "penalizacion", "penalizacionHastaCuota", "otrosCuota",
    "umbralRci", "costosCancelacionExtra", "spreadCambiario", "impuestoRendimiento", "tasaDeuda",
    "inflacion", "dolar", "crecimientoDolar", "ingresos", "crecimientoIngresos",
    "gastos", "crecimientoGastos", "rendimientoAhorros", "casa",
    "crecimientoCasa", "objetivo", "crecimientoObjetivo", "costosVenta",
    "costosCompra", "reserva", "ahorroUsd"
];

const FORM_STORAGE_KEY = "calculadora_credito_uva_form";
const MARKET_DATA_TIMEOUT_MS = 5000;
const MARKET_DATA_ENDPOINTS = {
    dollar: "https://dolarapi.com/v1/dolares/oficial",
    uva: "https://api.argentinadatos.com/v1/finanzas/indices/uva"
};

const MODE_SPECIFIC_IDS = new Set([
    "cuota", "totalCuotas", "tasa", "saldoUva", "uva",
    "valorOriginalUsd", "dolarOriginal", "financiacion", "plazoOriginal",
    "tasaOriginal", "uvaOriginal", "cuotaOriginal", "uvaActualOriginal"
]);

function getFormState() {
    const data = {
        loanMode: getLoanMode(),
        rateMode: getRateMode()
    };

    NUMERIC_IDS.forEach(id => {
        const field = $(id);
        if (field) data[id] = field.value;
    });

    return data;
}

function saveFormState() {
    try {
        localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(getFormState()));
    } catch (err) {
        // Ignore storage errors so the calculator remains usable.
    }
}

function loadFormState() {
    try {
        const saved = localStorage.getItem(FORM_STORAGE_KEY);
        if (!saved) return false;

        const data = JSON.parse(saved);
        if (data.loanMode) {
            const radio = document.querySelector(`input[name="loanMode"][value="${data.loanMode}"]`);
            if (radio) radio.checked = true;
        }
        if (data.rateMode) {
            const radio = document.querySelector(`input[name="rateMode"][value="${data.rateMode}"]`);
            if (radio) radio.checked = true;
        }

        NUMERIC_IDS.forEach(id => {
            if (data[id] !== undefined && $(id)) $(id).value = data[id];
        });
        return true;
    } catch (err) {
        // Ignore invalid or unavailable stored data and use the defaults.
        return false;
    }
}

async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MARKET_DATA_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

function getDollarValue(data) {
    const value = Number(data?.venta);
    return Number.isFinite(value) && value > 0 ? value : null;
}

function getLatestUvaValue(data) {
    if (!Array.isArray(data)) return null;

    for (let index = data.length - 1; index >= 0; index -= 1) {
        const value = Number(data[index]?.valor);
        if (Number.isFinite(value) && value > 0) return value;
    }

    return null;
}

async function loadCurrentMarketValues() {
    const results = await Promise.allSettled([
        fetchJson(MARKET_DATA_ENDPOINTS.dollar),
        fetchJson(MARKET_DATA_ENDPOINTS.uva)
    ]);

    const dollarResult = results[0];
    const uvaResult = results[1];
    const dollar = dollarResult.status === "fulfilled" ? getDollarValue(dollarResult.value) : null;
    const uva = uvaResult.status === "fulfilled" ? getLatestUvaValue(uvaResult.value) : null;

    if (dollar !== null) $("dolar").value = dollar;
    if (uva !== null) {
        $("uva").value = uva;
        $("uvaActualOriginal").value = uva;
    }

    if (dollar !== null || uva !== null) {
        saveFormState();
        updateLoanModeUI();
        tryCalcular();
    }
}

function getParams() {
    const mode = getLoanMode();

    return {
        mode,
        rateMode: getRateMode(),
        cuota: mode === "balance" ? n("cuota") : n("cuotaOriginal"),
        total: mode === "balance" ? n("totalCuotas") : n("plazoOriginal"),
        tasa: (mode === "balance" ? n("tasa") : n("tasaOriginal")) / 100,
        saldoUva: mode === "balance" ? n("saldoUva") : 0,
        uva: mode === "balance" ? n("uva") : n("uvaActualOriginal"),
        penal: n("penalizacion") / 100,
        penalizacionHastaCuota: n("penalizacionHastaCuota"),
        otrosCuota: n("otrosCuota"),
        umbralRci: n("umbralRci") / 100,
        costosCancelacionExtra: n("costosCancelacionExtra"),
        spreadCambiario: n("spreadCambiario") / 100,
        impuestoRendimiento: n("impuestoRendimiento") / 100,
        tasaDeuda: n("tasaDeuda") / 100,
        inflacion: n("inflacion") / 100,
        dolar: n("dolar"),
        gDolar: n("crecimientoDolar") / 100,
        ingresos: n("ingresos"),
        gIngresos: n("crecimientoIngresos") / 100,
        gastos: n("gastos"),
        gGastos: n("crecimientoGastos") / 100,
        rendimientoAhorros: n("rendimientoAhorros") / 100,
        casa: n("casa"),
        gCasa: n("crecimientoCasa") / 100,
        objetivo: n("objetivo"),
        gObjetivo: n("crecimientoObjetivo") / 100,
        costosVenta: n("costosVenta") / 100,
        costosCompra: n("costosCompra") / 100,
        reserva: n("reserva"),
        ahorroUsd: n("ahorroUsd")
    };
}

function monthlyRateFromAnnual(annualRate, rateMode) {
    return rateMode === "tna" ? annualRate / 12 : Math.pow(1 + annualRate, 1 / 12) - 1;
}

function frenchPayment(principalUva, monthlyRate, numberOfPayments) {
    if (numberOfPayments <= 0) return 0;
    if (monthlyRate === 0) return principalUva / numberOfPayments;
    return principalUva * monthlyRate /
        (1 - Math.pow(1 + monthlyRate, -numberOfPayments));
}

function frenchBalanceAfterPayment(principalUva, paymentUva, monthlyRate, paymentNumber) {
    if (paymentNumber <= 0) return principalUva;
    if (monthlyRate === 0) {
        return Math.max(0, principalUva - paymentUva * paymentNumber);
    }

    const k = paymentNumber;
    return Math.max(
        0,
        principalUva * Math.pow(1 + monthlyRate, k) -
        paymentUva * (Math.pow(1 + monthlyRate, k) - 1) / monthlyRate
    );
}

function buildLoan(p) {
    const monthlyRate = monthlyRateFromAnnual(p.tasa, p.rateMode);

    if (p.mode === "original") {
        const viviendaOriginalArs = n("valorOriginalUsd") * n("dolarOriginal");
        const capitalOriginalArs = viviendaOriginalArs * n("financiacion") / 100;
        const capitalOriginalUva = capitalOriginalArs / n("uvaOriginal");
        const cuotaUva = frenchPayment(capitalOriginalUva, monthlyRate, p.total);
        const saldoActualUva = frenchBalanceAfterPayment(
            capitalOriginalUva,
            cuotaUva,
            monthlyRate,
            p.cuota
        );

        return {
            mode: "original",
            currentPayment: p.cuota,
            totalPayments: p.total,
            annualRate: p.tasa,
            monthlyRate,
            originalHouseUsd: n("valorOriginalUsd"),
            originalExchangeRate: n("dolarOriginal"),
            financingPct: n("financiacion"),
            originalTermMonths: p.total,
            originalUvaArs: n("uvaOriginal"),
            originalHouseArs: viviendaOriginalArs,
            originalCapitalArs: capitalOriginalArs,
            originalCapitalUva: capitalOriginalUva,
            paymentUva: cuotaUva,
            currentBalanceUva: saldoActualUva,
            currentUvaArs: n("uvaActualOriginal")
        };
    }

    const remainingPayments = Math.max(0, p.total - p.cuota);
    const cuotaUva = frenchPayment(p.saldoUva, monthlyRate, remainingPayments);

    return {
        mode: "balance",
        currentPayment: p.cuota,
        totalPayments: p.total,
        annualRate: p.tasa,
        monthlyRate,
        originalHouseUsd: null,
        originalExchangeRate: null,
        financingPct: null,
        originalTermMonths: p.total,
        originalUvaArs: null,
        originalHouseArs: null,
        originalCapitalArs: null,
        originalCapitalUva: null,
        paymentUva: cuotaUva,
        currentBalanceUva: p.saldoUva,
        currentUvaArs: p.uva
    };
}

function getLoanState(month, loan, economic) {
    const cancellationQuota = loan.currentPayment + month;
    const saldoUva = month === 0 ?
        loan.currentBalanceUva :
        frenchBalanceAfterPayment(
            loan.currentBalanceUva,
            loan.paymentUva,
            loan.monthlyRate,
            month
        );

    const uvaArs = loan.currentUvaArs * Math.pow(
        1 + UVA_GROWTH_MODEL.fromInflation(economic.inflacion),
        month
    );
    const dolar = economic.dolar * Math.pow(1 + economic.gDolar, month);
    const cuotaArs = loan.paymentUva * uvaArs + economic.otrosCuota;

    const penalApplies = cancellationQuota <= economic.penalizacionHastaCuota;
    const saldoArs = saldoUva * uvaArs;
    const penalizacionArs = penalApplies ? saldoArs * economic.penal : 0;
    const costoCancelacion = saldoArs + penalizacionArs + economic.costosCancelacionExtra;

    return {
        month,
        cuotaNumero: cancellationQuota,
        cuotaUva: loan.paymentUva,
        cuotaArs,
        saldoUva,
        saldoArs,
        saldoUsd: dolar ? saldoArs / dolar : 0,
        uva: uvaArs,
        dolar,
        penalApplies,
        penalizacionArs,
        costoCancelacion
    };
}

function updateDerivedLoanInfo() {
    const mode = getLoanMode();
    const p = getParams();

    if (mode === "original") {
        const loan = buildLoan(p);
        $("valorOriginalArs").textContent = money(loan.originalHouseArs);
        $("capitalOriginalArs").textContent = money(loan.originalCapitalArs);
        $("capitalOriginalUva").textContent = num(loan.originalCapitalUva);
        $("cuotaOriginalUva").textContent = num(loan.paymentUva);
        $("saldoOriginalUva").textContent = num(loan.currentBalanceUva);
        $("balanceDerived").style.display = "none";
    } else {
        const loan = buildLoan(p);
        $("cuotaUva").textContent = num(loan.paymentUva);
        $("cuotaArs").textContent = money(loan.paymentUva * p.uva);
        $("balanceDerived").style.display = "block";
    }
}

function validateFields() {
    let valid = true;
    const mode = getLoanMode();

    NUMERIC_IDS.forEach(id => {
        const el = $(id);
        if (!el) return;

        const shouldValidate = !MODE_SPECIFIC_IDS.has(id) ||
            (mode === "balance" && ["cuota", "totalCuotas", "tasa", "saldoUva", "uva"].includes(id)) ||
            (mode === "original" && [
                "valorOriginalUsd", "dolarOriginal", "financiacion", "plazoOriginal",
                "tasaOriginal", "uvaOriginal", "cuotaOriginal", "uvaActualOriginal"
            ].includes(id));

        if (!shouldValidate) {
            el.classList.remove("invalid");
            return;
        }

        const raw = el.value.trim();
        let bad = raw === "" || isNaN(Number(raw));

        if ([
                "saldoUva", "uva", "valorOriginalUsd", "dolarOriginal", "uvaOriginal",
                "uvaActualOriginal"
            ].includes(id) && Number(raw) <= 0) bad = true;

        if (["cuota", "totalCuotas", "plazoOriginal", "cuotaOriginal"].includes(id) &&
            Number(raw) < 1) bad = true;

        if (id === "financiacion" && (Number(raw) <= 0 || Number(raw) > 100)) bad = true;

        el.classList.toggle("invalid", bad);
        if (bad) valid = false;
    });

    if (mode === "balance" && n("cuota") > n("totalCuotas")) {
        $("cuota").classList.add("invalid");
        valid = false;
    }

    if (mode === "original" && n("cuotaOriginal") > n("plazoOriginal")) {
        $("cuotaOriginal").classList.add("invalid");
        valid = false;
    }

    return valid;
}

function tryCalcular() {
    updateDerivedLoanInfo();

    if (validateFields()) {
        calcular();
    } else {
        $("kpis").innerHTML =
            `<div class="missing-banner" style="grid-column:1/-1">Completá (o corregí) los campos marcados en rojo para ver la simulación.</div>`;
        $("tbody").innerHTML = "";
        lastRows = [];
        chartPoints = [];
        savingsChartPoints = [];
        $("chart").getContext("2d").clearRect(0, 0, $("chart").width, $("chart").height);
        $("savingsChart").getContext("2d").clearRect(0, 0, $("savingsChart").width, $("savingsChart").height);
        $("chartTip").style.display = "none";
        $("savingsChartTip").style.display = "none";
    }
}

function calcular() {
    const p = getParams();
    const loan = buildLoan(p);
    const rows = [];

    let casa = p.casa;
    let objetivo = p.objetivo;
    let ingresos = p.ingresos;
    let gastos = p.gastos;
    let ahorroUsd = p.ahorroUsd;
    let deudaArs = 0;

    const rendimientoNeto = p.rendimientoAhorros * (1 - p.impuestoRendimiento);
    const rendMensual = Math.pow(1 + rendimientoNeto, 1 / 12) - 1;
    const rendMensualDeuda = monthlyRateFromAnnual(p.tasaDeuda, "tea");
    const horizonte = Math.max(0, loan.totalPayments - loan.currentPayment);

    for (let m = 0; m <= horizonte; m++) {
        const state = getLoanState(m, loan, p);
        const dolarCompra = state.dolar * (1 + p.spreadCambiario / 2);
        const dolarVenta = state.dolar * (1 - p.spreadCambiario / 2);
        const ventaBruta = casa * state.dolar;
        const ventaNeta = ventaBruta * (1 - p.costosVenta);
        const flujoMensual = ingresos - gastos - state.cuotaArs;
        let ahorroMensualUsd = 0;
        if (flujoMensual >= 0) {
            ahorroMensualUsd = flujoMensual / dolarCompra;
        } else {
            const faltanteArs = Math.abs(flujoMensual);
            const cubiertoConAhorroUsd = Math.min(ahorroUsd, faltanteArs / dolarVenta);
            ahorroUsd -= cubiertoConAhorroUsd;
            deudaArs += faltanteArs - cubiertoConAhorroUsd * dolarVenta;
        }
        const deudaUsd = state.dolar ? deudaArs / state.dolar : 0;
        const capitalAntesCompra = ahorroUsd * dolarVenta + ventaNeta - state.costoCancelacion - deudaArs;
        const objetivoArs = objetivo * state.dolar;
        const compraTotal = objetivoArs * (1 + p.costosCompra);
        const disponibleUsd = dolarCompra ? capitalAntesCompra / dolarCompra : 0;
        const gapUsd = disponibleUsd - objetivo * (1 + p.costosCompra);
        const reservaGap = gapUsd - p.reserva;
        const rci = state.cuotaArs / ingresos;

        rows.push({
            mes: m,
            cuotaNumero: state.cuotaNumero,
            cuota: state.cuotaArs,
            rci,
            cuotaUva: state.cuotaUva,
            saldoUva: state.saldoUva,
            saldoArs: state.saldoArs,
            saldoUsd: state.saldoUsd,
            uva: state.uva,
            casa,
            ventaNeta,
            capitalAntesCompra,
            objetivo,
            compraTotal,
            gapUsd,
            reservaGap,
            ahorroMensual: flujoMensual,
            ahorroUsd,
            deudaUsd,
            insolvente: deudaArs > 0,
            dolar: state.dolar,
            cancelacion: state.costoCancelacion,
            penalizacion: state.penalizacionArs,
            penalApplies: state.penalApplies
        });

        if (m < horizonte) {
            ahorroUsd = ahorroUsd * (1 + rendMensual) + ahorroMensualUsd;
            deudaArs = deudaArs * (1 + rendMensualDeuda);
            casa *= 1 + p.gCasa;
            objetivo *= 1 + p.gObjetivo;
            ingresos *= 1 + p.gIngresos;
            gastos *= 1 + p.gGastos;
        }
    }

    lastRows = rows;
    render(rows, p);
}

function render(rows, p) {
    const feasible = rows.filter(r => r.gapUsd >= 0 && r.reservaGap >= 0);
    const maxGapRow = rows.reduce((a, b) => b.gapUsd > a.gapUsd ? b : a, rows[0]);
    const firstFeasible = feasible[0];
    const firstRciExceeded = rows.find(r => r.rci > p.umbralRci);
    const firstInsolvent = rows.find(r => r.insolvente);

    $("kpis").innerHTML = `
    <div class="kpi"><div class="l">Mes con mayor excedente</div><div class="v good">Mes ${maxGapRow.mes}: ${money(maxGapRow.gapUsd,"USD")}</div></div>
    <div class="kpi"><div class="l">Primer mes que cubre compra + reserva</div><div class="v">${firstFeasible ? "Mes "+firstFeasible.mes : "No alcanzado en el horizonte"}</div></div>
    <div class="kpi"><div class="l">Cancelación hoy</div><div class="v">${money(rows[0].cancelacion)}</div></div>
    <div class="kpi"><div class="l">Cancelación en 24 meses</div><div class="v">${money((rows[24]||rows[rows.length-1]).cancelacion)}</div></div>
    <div class="kpi"><div class="l">Primer mes que supera el umbral RCI</div><div class="v">${firstRciExceeded ? "Mes " + firstRciExceeded.mes : "No se supera en el horizonte"}</div></div>
    <div class="kpi"><div class="l">Primer mes con deuda acumulada</div><div class="v">${firstInsolvent ? "Mes " + firstInsolvent.mes : "Nunca en el horizonte"}</div></div>
    `;

    $("tbody").innerHTML = rows.map(r => `
    <tr class="${r.insolvente ? "insolvente" : ""}">
        <td>${r.mes}</td>
        <td class="${r.rci > p.umbralRci ? "warn" : ""}">${money(r.cuota)}</td>
        <td>${money(r.saldoUsd,"USD")}</td>
        <td>${money(r.casa,"USD")}</td>
        <td>${money(r.ventaNeta)}</td>
        <td>${money(r.capitalAntesCompra)}</td>
        <td>${money(r.objetivo,"USD")}</td>
        <td>${money(r.compraTotal)}</td>
        <td class="${r.gapUsd>=0?"good":"warn"}">${money(r.gapUsd,"USD")}</td>
        <td>${money(r.ahorroMensual)}</td>
        <td>${money(r.ahorroUsd,"USD")}</td>
        <td class="${r.insolvente ? "insolvente" : ""}">${money(r.deudaUsd,"USD")}</td>
    </tr>`).join("");

    drawChart(rows, firstFeasible, maxGapRow, firstRciExceeded, firstInsolvent);
    drawSavingsChart(rows);
}

function drawChart(rows, firstFeasible, maxGapRow, firstRciExceeded, firstInsolvent) {
    const c = $("chart"),
        ctx = c.getContext("2d");
    const bounds = c.getBoundingClientRect();
    const W = Math.max(1, Math.round(bounds.width)),
        H = 340,
        dpr = window.devicePixelRatio || 1;

    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const pad = {
        l: 70,
        r: 25,
        t: 30,
        b: 45
    };
    const vals = rows.map(r => r.gapUsd);
    const min = Math.min(...vals),
        max = Math.max(...vals);
    const range = (max - min) || 1;
    const x = i => rows.length > 1 ?
        pad.l + i * (W - pad.l - pad.r) / (rows.length - 1) :
        (pad.l + (W - pad.l - pad.r) / 2);
    const y = v => pad.t + (max - v) / range * (H - pad.t - pad.b);

    ctx.strokeStyle = "#c9ced6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (min <= 0 && max >= 0) {
        ctx.moveTo(pad.l, y(0));
        ctx.lineTo(W - pad.r, y(0));
    }
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, H - pad.b);
    ctx.stroke();

    chartPoints = [];
    ctx.beginPath();
    rows.forEach((r, i) => {
        const X = x(i),
            Y = y(r.gapUsd);
        if (i) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
        chartPoints.push({
            x: X,
            y: Y,
            row: r
        });
    });
    ctx.strokeStyle = "#2457a6";
    ctx.lineWidth = 2;
    ctx.stroke();

    function marker(row, color, label, dy) {
        if (!row) return;
        const i = rows.indexOf(row);
        if (i < 0) return;
        const X = x(i),
            Y = y(row.gapUsd);
        ctx.beginPath();
        ctx.arc(X, Y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = "11px system-ui";
        const labelX = Math.min(Math.max(X - 40, pad.l), W - pad.r - 90);
        ctx.fillText(label, labelX, Y + dy);
    }

    marker(maxGapRow, "#176b3a", "Mayor excedente", -10);
    marker(firstFeasible, "#2457a6", "Primer mes que alcanza", 18);
    marker(firstRciExceeded, "#9a6500", "RCI supera umbral", -24);
    marker(firstInsolvent, "#b42318", "Primera deuda", 30);

    ctx.fillStyle = "#68707a";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Eje X: mes desde hoy", (pad.l + W - pad.r) / 2, H - 2);
    ctx.save();
    ctx.translate(16, (pad.t + H - pad.b) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Eje Y: excedente (+) / faltante (-) en USD", 0, 0);
    ctx.restore();
    ctx.textAlign = "start";
    ctx.fillText(num(min), 5, H - pad.b + 5);
    ctx.fillText(num(max), 5, pad.t + 5);
    for (let i = 0; i < rows.length; i += Math.max(1, Math.floor(rows.length / 10))) {
        ctx.fillText(String(rows[i].mes), x(i) - 5, H - 15);
    }
}

function drawSavingsChart(rows) {
    const c = $("savingsChart"),
        ctx = c.getContext("2d");
    const bounds = c.getBoundingClientRect();
    const W = Math.max(1, Math.round(bounds.width)),
        H = 340,
        dpr = window.devicePixelRatio || 1;

    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const pad = { l: 70, r: 25, t: 30, b: 45 };
    const vals = rows.flatMap(r => [r.ahorroUsd, r.deudaUsd]);
    const min = Math.min(...vals, 0);
    const max = Math.max(...vals, 0);
    const range = (max - min) || 1;
    const x = i => rows.length > 1 ?
        pad.l + i * (W - pad.l - pad.r) / (rows.length - 1) :
        (pad.l + (W - pad.l - pad.r) / 2);
    const y = value => pad.t + (max - value) / range * (H - pad.t - pad.b);

    ctx.strokeStyle = "#c9ced6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, y(0));
    ctx.lineTo(W - pad.r, y(0));
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, H - pad.b);
    ctx.stroke();

    savingsChartPoints = [];
    ctx.beginPath();
    rows.forEach((r, i) => {
        const X = x(i),
            Y = y(r.ahorroUsd);
        if (i) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
        savingsChartPoints.push({ x: X, y: Y, row: r });
    });
    ctx.strokeStyle = "#176b3a";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    rows.forEach((r, i) => {
        const X = x(i),
            Y = y(r.deudaUsd);
        if (i) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
    });
    ctx.strokeStyle = "#b8341f";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#68707a";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Eje X: mes desde hoy", (pad.l + W - pad.r) / 2, H - 2);
    ctx.save();
    ctx.translate(16, (pad.t + H - pad.b) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Eje Y: ahorro / deuda en USD", 0, 0);
    ctx.restore();
    ctx.textAlign = "start";
    ctx.fillText(num(min), 5, H - pad.b + 5);
    ctx.fillText(num(max), 5, pad.t + 5);
    for (let i = 0; i < rows.length; i += Math.max(1, Math.floor(rows.length / 10))) {
        ctx.fillText(String(rows[i].mes), x(i) - 5, H - 15);
    }
}

$("chart").addEventListener("mousemove", e => {
    if (!chartPoints.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = Math.round(rect.width) / rect.width;
    const scaleY = 340 / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    let nearest = chartPoints[0],
        best = Infinity;

    for (const pt of chartPoints) {
        const d = Math.abs(pt.x - mx);
        if (d < best) {
            best = d;
            nearest = pt;
        }
    }

    const tip = $("chartTip");
    tip.style.left = Math.min(nearest.x / scaleX + 10, rect.width - 190) + "px";
    tip.style.top = Math.max(nearest.y / scaleY - 55, 0) + "px";
    tip.style.display = "block";
    tip.innerHTML =
        `Mes ${nearest.row.mes}<br>${nearest.row.gapUsd>=0?"Excedente":"Faltante"}: ${money(nearest.row.gapUsd,"USD")}<br>Capital disp.: ${money(nearest.row.capitalAntesCompra)}`;
});

$("chart").addEventListener("mouseleave", () => {
    $("chartTip").style.display = "none";
});

$("savingsChart").addEventListener("mousemove", e => {
    if (!savingsChartPoints.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = Math.round(rect.width) / rect.width;
    const scaleY = 340 / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    let nearest = savingsChartPoints[0],
        best = Infinity;

    for (const pt of savingsChartPoints) {
        const d = Math.abs(pt.x - mx);
        if (d < best) {
            best = d;
            nearest = pt;
        }
    }

    const tip = $("savingsChartTip");
    tip.style.left = Math.min(nearest.x / scaleX + 10, rect.width - 190) + "px";
    tip.style.top = Math.max(nearest.y / scaleY - 55, 0) + "px";
    tip.style.display = "block";
    tip.innerHTML = `Mes ${nearest.row.mes}<br>Ahorro acumulado: ${money(nearest.row.ahorroUsd, "USD")}<br>Deuda acumulada: ${money(nearest.row.deudaUsd, "USD")}`;
});

$("savingsChart").addEventListener("mouseleave", () => {
    $("savingsChartTip").style.display = "none";
});

window.addEventListener("resize", () => {
    if (!lastRows.length) return;
    const feasible = lastRows.filter(r => r.gapUsd >= 0 && r.reservaGap >= 0);
    const maxGapRow = lastRows.reduce((a, b) => b.gapUsd > a.gapUsd ? b : a, lastRows[0]);
    const p = getParams();
    drawChart(
        lastRows,
        feasible[0],
        maxGapRow,
        lastRows.find(r => r.rci > p.umbralRci),
        lastRows.find(r => r.insolvente)
    );
    drawSavingsChart(lastRows);
});

function exportarCSV() {
    if (!lastRows.length) {
        tryCalcular();
        if (!lastRows.length) return;
    }

    const headers = [
        "mes", "cuota_numero", "cuota_UVA", "cuota_ARS", "saldo_UVA",
        "saldo_ARS", "saldo_USD", "vivienda_actual_USD", "venta_neta_ARS",
        "capital_disponible_ARS", "objetivo_USD", "compra_total_ARS",
        "faltante_excedente_USD", "ahorro_mensual_ARS", "ahorro_acumulado_USD",
        "dolar", "uva", "penalizacion_ARS", "cancelacion_ARS", "rci", "deuda_acumulada_USD"
    ];

    const lines = [headers.join(";"), ...lastRows.map(r => [
        r.mes, r.cuotaNumero, r.cuotaUva, r.cuota, r.saldoUva, r.saldoArs,
        r.saldoUsd, r.casa, r.ventaNeta, r.capitalAntesCompra, r.objetivo,
        r.compraTotal, r.gapUsd, r.ahorroMensual, r.ahorroUsd, r.dolar, r.uva,
        r.penalizacion, r.cancelacion, r.rci, r.deudaUsd
    ].join(";"))];

    const blob = new Blob(["\ufeff" + lines.join("\n")], {
        type: "text/csv;charset=utf-8"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "escenarios_credito_uva.csv";
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportarJSON() {
    const data = {
        loanMode: getLoanMode(),
        rateMode: getRateMode()
    };
    NUMERIC_IDS.forEach(id => {
        if ($(id)) data[id] = $(id).value;
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "parametros_credito_uva.json";
    a.click();
    URL.revokeObjectURL(a.href);
}

function importarJSON() {
    $("jsonFile").click();
}

function onJSONFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);

            if (data.loanMode) {
                const radio = document.querySelector(`input[name="loanMode"][value="${data.loanMode}"]`);
                if (radio) radio.checked = true;
                updateLoanModeUI();
            }
            if (data.rateMode) {
                const radio = document.querySelector(`input[name="rateMode"][value="${data.rateMode}"]`);
                if (radio) radio.checked = true;
            }

            NUMERIC_IDS.forEach(id => {
                if (data[id] !== undefined && $(id)) $(id).value = data[id];
            });

            syncSliders();
            tryCalcular();
        } catch (err) {
            alert("El archivo seleccionado no es un JSON válido.");
        }
    };

    reader.readAsText(file);
    e.target.value = "";
}

function linkSlider(numId, sliderId) {
    const numEl = $(numId),
        sliderEl = $(sliderId);
    sliderEl.addEventListener("input", () => {
        numEl.value = sliderEl.value;
    });
    numEl.addEventListener("input", () => {
        if (numEl.value !== "" && !isNaN(Number(numEl.value))) sliderEl.value = numEl.value;
    });
}

function syncSliders() {
    ["ingresos", "gastos", "crecimientoDolar"].forEach(id => {
        const s = $(id + "_slider");
        if (s && $(id).value !== "" && !isNaN(Number($(id).value))) s.value = $(id).value;
    });
}

function updateLoanModeUI() {
    const mode = getLoanMode();
    $("balanceMode").style.display = mode === "balance" ? "block" : "none";
    $("originalMode").style.display = mode === "original" ? "block" : "none";
    updateDerivedLoanInfo();
}

linkSlider("ingresos", "ingresos_slider");
linkSlider("gastos", "gastos_slider");
linkSlider("crecimientoDolar", "crecimientoDolar_slider");

document.querySelectorAll('input[name="loanMode"]').forEach(el => {
    el.addEventListener("change", () => {
        updateLoanModeUI();
        saveFormState();
        tryCalcular();
    });
});

document.querySelectorAll('input[name="rateMode"]').forEach(el => {
    el.addEventListener("change", () => {
        saveFormState();
        tryCalcular();
    });
});

document.querySelector("main").addEventListener("input", e => {
    if (e.target.tagName === "INPUT" && e.target.type !== "file") {
        saveFormState();
        tryCalcular();
    }
});

loadFormState();
syncSliders();
updateLoanModeUI();
tryCalcular();
loadCurrentMarketValues();