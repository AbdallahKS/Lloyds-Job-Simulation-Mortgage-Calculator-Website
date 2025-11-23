import React, { useState, useEffect } from "react";
import "./App.css";

// Helper to safely convert strings (incl. with commas) into numbers
function parseNumber(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Format a string as a UK-style number with commas
function formatNumberString(value) {
  const num = parseNumber(value);
  if (!num) return "";
  return num.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

// Reusable tooltip component
function InfoTip({ text }) {
  return (
    <span className="info-tip">
      ?
      <span className="info-tip-text">{text}</span>
    </span>
  );
}

const EMPTY_FORM = {
  propertyPrice: "",
  deposit: "",
  income: "",
  term: "",
  mortgageType: "fixed",
  interestRate: "",
  repaymentType: "repayment",
  interestRateB: "", // optional comparison scenario
};

// Build sample repayment schedule (first 3 + last 3 months)
function buildScheduleSamples(
  loanAmount,
  interestRateNum,
  termYears,
  monthlyPayment
) {
  if (
    loanAmount <= 0 ||
    interestRateNum <= 0 ||
    termYears <= 0 ||
    monthlyPayment <= 0
  ) {
    return { first: [], last: [] };
  }

  const r = interestRateNum / 100 / 12;
  const n = termYears * 12;
  let balance = loanAmount;
  const rows = [];

  for (let month = 1; month <= n; month++) {
    const interest = balance * r;
    const principal = monthlyPayment - interest;
    balance = balance - principal;
    if (balance < 0) balance = 0;

    rows.push({
      month,
      principal: principal > 0 ? principal : 0,
      interest: interest > 0 ? interest : 0,
      balance: balance > 0 ? balance : 0,
    });

    if (balance <= 0) break;
  }

  const first = rows.slice(0, 3);
  const last = rows.slice(-3);
  return { first, last };
}

function App() {
  // Load saved form data from localStorage if available
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem("mortgageFormData");
      return saved ? { ...EMPTY_FORM, ...JSON.parse(saved) } : EMPTY_FORM;
    } catch {
      return EMPTY_FORM;
    }
  });

  // Load saved step from localStorage if available
  const [step, setStep] = useState(() => {
    try {
      const savedStep = localStorage.getItem("mortgageStep");
      const n = savedStep ? Number(savedStep) : 1;
      return n >= 1 && n <= 3 ? n : 1;
    } catch {
      return 1;
    }
  });

  // Dark mode toggle (saved)
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem("mortgageDarkMode");
      return saved === "true";
    } catch {
      return false;
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Allow commas / free text in input; we validate and parse separately
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const formatFieldOnBlur = (name) => {
    setFormData((prev) => ({
      ...prev,
      [name]: formatNumberString(prev[name]),
    }));
  };

  const clearAll = () => {
    setFormData(EMPTY_FORM);
    setStep(1);
    try {
      localStorage.removeItem("mortgageFormData");
      localStorage.removeItem("mortgageStep");
    } catch {
      // ignore
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 3));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  // ---- Parse values for validation + calculation ----
  const propertyPriceNum = parseNumber(formData.propertyPrice);
  const depositNum = parseNumber(formData.deposit);
  const incomeNum = parseNumber(formData.income);
  const termYears = parseNumber(formData.term);
  const interestRateNum = parseNumber(formData.interestRate);
  const interestRateBNum = parseNumber(formData.interestRateB);

  // Basic field validity checks (for inline errors)
  const propertyPriceValid =
    formData.propertyPrice === "" || propertyPriceNum > 0;
  const depositValid = formData.deposit === "" || depositNum >= 0;
  const incomeValid = formData.income === "" || incomeNum > 0;
  const termValid = formData.term === "" || termYears > 0;
  const interestRateValid =
    formData.interestRate === "" ||
    (interestRateNum > 0 && interestRateNum < 100);
  const interestRateBValid =
    formData.interestRateB === "" ||
    (interestRateBNum > 0 && interestRateBNum < 100);

  // Validation: only allow progress with appropriate numeric values
  const canGoToStep2 =
    propertyPriceNum > 0 &&
    depositNum >= 0 &&
    incomeNum > 0 &&
    termYears > 0 &&
    propertyPriceValid &&
    depositValid &&
    incomeValid &&
    termValid;

  const canGoToStep3 =
    interestRateNum > 0 && interestRateNum < 100 && interestRateValid;

  // Calculation section – Scenario A
  const loanAmount =
    propertyPriceNum && depositNum >= 0
      ? Math.max(propertyPriceNum - depositNum, 0)
      : 0;

  let monthlyPayment = 0;
  let totalPayment = 0;
  let totalInterest = 0;

  if (loanAmount > 0 && interestRateNum > 0 && termYears > 0) {
    const years = termYears;
    const r = interestRateNum / 100 / 12; // monthly interest rate
    const n = years * 12; // months

    if (r === 0) {
      monthlyPayment = loanAmount / n;
    } else {
      monthlyPayment =
        (loanAmount * r * Math.pow(1 + r, n)) /
        (Math.pow(1 + r, n) - 1);
    }

    totalPayment = monthlyPayment * n;
    totalInterest = totalPayment - loanAmount;
  }

  // Scenario B (comparison) – optional
  let monthlyPaymentB = 0;
  let totalPaymentB = 0;
  let totalInterestB = 0;
  const hasScenarioB =
    loanAmount > 0 &&
    interestRateBNum > 0 &&
    interestRateBNum < 100 &&
    termYears > 0;

  if (hasScenarioB) {
    const yearsB = termYears;
    const rB = interestRateBNum / 100 / 12;
    const nB = yearsB * 12;

    if (rB === 0) {
      monthlyPaymentB = loanAmount / nB;
    } else {
      monthlyPaymentB =
        (loanAmount * rB * Math.pow(1 + rB, nB)) /
        (Math.pow(1 + rB, nB) - 1);
    }

    totalPaymentB = monthlyPaymentB * nB;
    totalInterestB = totalPaymentB - loanAmount;
  }

  const ltv =
    loanAmount > 0 && propertyPriceNum > 0
      ? (loanAmount / propertyPriceNum) * 100
      : 0;

  // Schedule samples for Scenario A
  const scheduleSamples = buildScheduleSamples(
    loanAmount,
    interestRateNum,
    termYears,
    monthlyPayment
  );

  // ---- Save to localStorage whenever data or step changes ----
  useEffect(() => {
    try {
      localStorage.setItem("mortgageFormData", JSON.stringify(formData));
    } catch {
      // ignore storage errors
    }
  }, [formData]);

  useEffect(() => {
    try {
      localStorage.setItem("mortgageStep", String(step));
    } catch {
      // ignore storage errors
    }
  }, [step]);

  useEffect(() => {
    try {
      localStorage.setItem("mortgageDarkMode", String(darkMode));
    } catch {
      // ignore
    }
  }, [darkMode]);

  return (
    <div className={darkMode ? "app dark" : "app"}>
      <header className="header">
        <div>
          <h1>Lloyds Mortgage Calculator (Prototype)</h1>
          <p>Redesigned based on customer feedback</p>
        </div>
        <button
          className="dark-toggle"
          onClick={() => setDarkMode((d) => !d)}
        >
          {darkMode ? "☀ Light mode" : "🌙 Dark mode"}
        </button>
      </header>

      <ProgressBar step={step} />

      <div className="top-actions">
        <p className="step-helper">
          Step {step} of 3 –{" "}
          {step === 1 && "Tell us about the property and your basic details."}
          {step === 2 && "Choose your mortgage options and interest rate."}
          {step === 3 &&
            "Review your estimated monthly payment and mortgage breakdown."}
        </p>
        <button className="clear-btn" onClick={clearAll}>
          Clear all data
        </button>
      </div>

      {step === 1 && (
        <StepOneDetails
          formData={formData}
          handleChange={handleChange}
          formatFieldOnBlur={formatFieldOnBlur}
          nextStep={nextStep}
          canGoToStep2={canGoToStep2}
          validity={{ propertyPriceValid, depositValid, incomeValid, termValid }}
        />
      )}

      {step === 2 && (
        <StepTwoOptions
          formData={formData}
          handleChange={handleChange}
          nextStep={nextStep}
          prevStep={prevStep}
          canGoToStep3={canGoToStep3}
          interestRateValid={interestRateValid}
          interestRateBValid={interestRateBValid}
        />
      )}

      {step === 3 && (
        <StepThreeResults
          formData={formData}
          loanAmount={loanAmount}
          monthlyPayment={monthlyPayment}
          totalInterest={totalInterest}
          totalPayment={totalPayment}
          ltv={ltv}
          monthlyPaymentB={monthlyPaymentB}
          totalInterestB={totalInterestB}
          totalPaymentB={totalPaymentB}
          hasScenarioB={hasScenarioB}
          scheduleSamples={scheduleSamples}
          prevStep={prevStep}
        />
      )}
    </div>
  );
}

function ProgressBar({ step }) {
  return (
    <div className="progress">
      <div className={step === 1 ? "step active" : "step"}>
        1. Your Details
      </div>
      <div className={step === 2 ? "step active" : "step"}>
        2. Mortgage Options
      </div>
      <div className={step === 3 ? "step active" : "step"}>
        3. Results
      </div>
    </div>
  );
}

function StepOneDetails({
  formData,
  handleChange,
  formatFieldOnBlur,
  nextStep,
  canGoToStep2,
  validity,
}) {
  const { propertyPriceValid, depositValid, incomeValid, termValid } = validity;

  const showErrors =
    formData.propertyPrice ||
    formData.deposit ||
    formData.income ||
    formData.term;

  return (
    <section className="card">
      <h2>Step 1 – Your Details</h2>
      <p>
        Enter some basic information about the property and your situation so we
        can estimate your borrowing.
      </p>

      <div className="grid">
        <div
          className={`field ${
            !propertyPriceValid && showErrors ? "error" : ""
          }`}
        >
          <label>
            Property price (£)
            <InfoTip text="The total price of the property you want to buy." />
          </label>
          <input
            type="text"
            name="propertyPrice"
            value={formData.propertyPrice}
            onChange={handleChange}
            onBlur={() => formatFieldOnBlur("propertyPrice")}
            placeholder="e.g. 250,000"
          />
          {!propertyPriceValid && showErrors && (
            <span className="field-error">
              Please enter a valid property price greater than 0.
            </span>
          )}
        </div>

        <div
          className={`field ${!depositValid && showErrors ? "error" : ""}`}
        >
          <label>
            Deposit (£)
            <InfoTip text="The amount you pay upfront towards the property. The mortgage covers the rest." />
          </label>
          <input
            type="text"
            name="deposit"
            value={formData.deposit}
            onChange={handleChange}
            onBlur={() => formatFieldOnBlur("deposit")}
            placeholder="e.g. 30,000"
          />
          {!depositValid && showErrors && (
            <span className="field-error">
              Please enter a valid deposit (0 or more).
            </span>
          )}
        </div>

        <div
          className={`field ${!incomeValid && showErrors ? "error" : ""}`}
        >
          <label>
            Annual income (£)
            <InfoTip text="Your yearly income before tax. Lenders use this to assess what you can afford." />
          </label>
          <input
            type="text"
            name="income"
            value={formData.income}
            onChange={handleChange}
            onBlur={() => formatFieldOnBlur("income")}
            placeholder="e.g. 35,000"
          />
          {!incomeValid && showErrors && (
            <span className="field-error">
              Please enter a valid income greater than 0.
            </span>
          )}
        </div>

        <div className={`field ${!termValid && showErrors ? "error" : ""}`}>
          <label>
            Loan term (years)
            <InfoTip text="How many years you want to repay the mortgage over (e.g. 25 years)." />
          </label>
          <input
            type="text"
            name="term"
            value={formData.term}
            onChange={handleChange}
            onBlur={() => formatFieldOnBlur("term")}
            placeholder="e.g. 25"
          />
          {!termValid && showErrors && (
            <span className="field-error">
              Please enter a valid term in years (greater than 0).
            </span>
          )}
        </div>
      </div>

      {!canGoToStep2 && showErrors && (
        <p className="helper-text">
          To continue, please make sure all values are valid numbers (no letters
          or symbols) and greater than zero.
        </p>
      )}

      <div className="actions">
        <button className="primary" onClick={nextStep} disabled={!canGoToStep2}>
          Next →
        </button>
      </div>
    </section>
  );
}

function StepTwoOptions({
  formData,
  handleChange,
  nextStep,
  prevStep,
  canGoToStep3,
  interestRateValid,
  interestRateBValid,
}) {
  const showErrorMain = formData.interestRate !== "";
  const showErrorB = formData.interestRateB !== "";

  return (
    <section className="card">
      <h2>Step 2 – Mortgage Options</h2>
      <p>
        Choose the type of mortgage you prefer and the interest rate you want to
        model. You can also add a comparison rate to see a second scenario.
      </p>

      <div className="field">
        <label>
          Mortgage type
          <InfoTip text="Fixed rate: stays the same for a set period. Variable rate: can change based on market conditions." />
        </label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              name="mortgageType"
              value="fixed"
              checked={formData.mortgageType === "fixed"}
              onChange={handleChange}
            />
            Fixed rate
          </label>
          <label>
            <input
              type="radio"
              name="mortgageType"
              value="variable"
              checked={formData.mortgageType === "variable"}
              onChange={handleChange}
            />
            Variable rate
          </label>
        </div>
      </div>

      {/* MAIN INTEREST RATE – slider + number input */}
      <div
        className={`field ${
          !interestRateValid && showErrorMain ? "error" : ""
        }`}
      >
        <label>
          Interest rate – Scenario A (%)
          <InfoTip text="The percentage charged on the mortgage each year. Higher rates mean higher monthly payments." />
        </label>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
          }}
        >
          {/* Slider control */}
          <input
            type="range"
            name="interestRate"
            min="0"
            max="10"
            step="0.1"
            value={formData.interestRate || 0}
            onChange={handleChange}
            style={{ flex: 1 }}
          />

          {/* Exact numeric input */}
          <input
            type="number"
            name="interestRate"
            min="0"
            max="100"
            step="0.1"
            value={formData.interestRate}
            onChange={handleChange}
            placeholder="4.5"
            style={{ width: "5rem" }}
          />
        </div>

        <p className="helper-text">
          Use the slider to pick a rate (0–10%) or type an exact value.
        </p>

        {!interestRateValid && showErrorMain && (
          <span className="field-error">
            Please enter a valid interest rate between 0 and 100.
          </span>
        )}
      </div>

      {/* OPTIONAL COMPARISON RATE – still text input */}
      <div
        className={`field ${
          !interestRateBValid && showErrorB ? "error" : ""
        }`}
      >
        <label>
          Optional comparison rate – Scenario B (%)
          <InfoTip text="Add a second interest rate to compare monthly payments and total cost against Scenario A." />
        </label>
        <input
          type="text"
          name="interestRateB"
          value={formData.interestRateB || ""}
          onChange={handleChange}
          placeholder="e.g. 5.0 (optional)"
        />
        {!interestRateBValid && showErrorB && (
          <span className="field-error">
            Please enter a valid comparison rate between 0 and 100, or leave it blank.
          </span>
        )}
      </div>

      <div className="field">
        <label>
          Repayment type
          <InfoTip text="Repayment: each payment reduces the loan and interest. Interest-only: you only pay interest during the term." />
        </label>
        <select
          name="repaymentType"
          value={formData.repaymentType}
          onChange={handleChange}
        >
          <option value="repayment">Repayment</option>
          <option value="interest-only">Interest-only</option>
        </select>
      </div>

      {!canGoToStep3 && showErrorMain && (
        <p className="helper-text">
          Please choose a valid interest rate to see your results.
        </p>
      )}

      <div className="actions">
        <button onClick={prevStep}>← Back</button>
        <button
          className="primary"
          onClick={nextStep}
          disabled={!canGoToStep3}
        >
          See results →
        </button>
      </div>
    </section>
  );
}

function StepThreeResults({
  formData,
  loanAmount,
  monthlyPayment,
  totalInterest,
  totalPayment,
  ltv,
  monthlyPaymentB,
  totalInterestB,
  totalPaymentB,
  hasScenarioB,
  scheduleSamples,
  prevStep,
}) {
  const hasResult = monthlyPayment > 0 && loanAmount > 0;

  // For the stacked bar
  const totalForBar =
    loanAmount > 0 && totalInterest > 0 ? loanAmount + totalInterest : 0;
  const principalPct =
    totalForBar > 0 ? (loanAmount / totalForBar) * 100 : 0;
  const interestPct =
    totalForBar > 0 ? (totalInterest / totalForBar) * 100 : 0;

  const { first: firstRows, last: lastRows } = scheduleSamples || {
    first: [],
    last: [],
  };

  return (
    <section className="card">
      <h2>Step 3 – Your Results</h2>
      <p>
        Review your estimated monthly payment and how your mortgage breaks down
        over time. Use the comparison to see how different interest rates affect
        cost.
      </p>

      <div className="results-main">
        <h3>
          Estimated monthly payment (Scenario A)
          <InfoTip text="An estimate of your monthly mortgage cost based on your inputs. Actual lender offers may differ." />
        </h3>
        <p className="monthly">
          £{hasResult ? monthlyPayment.toFixed(2) : "0.00"}
        </p>
      </div>

      <div className="results-grid">
        <div className="results-box">
          <h4>
            Loan amount
            <InfoTip text="Loan amount = Property price minus your deposit. This is how much you are borrowing." />
          </h4>
          <p>{loanAmount ? `£${loanAmount.toLocaleString()}` : "£0"}</p>
        </div>
        <div className="results-box">
          <h4>
            Loan-to-value (LTV)
            <InfoTip text="LTV compares the loan amount to the property price. Lower LTVs usually get better rates." />
          </h4>
          <p>{ltv ? `${ltv.toFixed(1)}%` : "–"}</p>
        </div>
        <div className="results-box">
          <h4>Total interest paid (Scenario A)</h4>
          <p>
            {totalInterest > 0
              ? `£${totalInterest.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`
              : "£0"}
          </p>
        </div>
        <div className="results-box">
          <h4>Total repaid over term (Scenario A)</h4>
          <p>
            {totalPayment > 0
              ? `£${totalPayment.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`
              : "£0"}
          </p>
        </div>
      </div>

      {hasScenarioB && (
        <div className="comparison-card">
          <h3>Scenario comparison</h3>
          <p>
            Comparing your main rate (
            <strong>{formData.interestRate}%</strong>) with your comparison rate{" "}
            (<strong>{formData.interestRateB}%</strong>).
          </p>
          <div className="comparison-grid">
            <div className="comparison-col">
              <h4>Scenario A</h4>
              <p>
                <strong>Monthly:</strong>{" "}
                {monthlyPayment > 0
                  ? `£${monthlyPayment.toFixed(2)}`
                  : "–"}
              </p>
              <p>
                <strong>Total interest:</strong>{" "}
                {totalInterest > 0
                  ? `£${totalInterest.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`
                  : "–"}
              </p>
              <p>
                <strong>Total repaid:</strong>{" "}
                {totalPayment > 0
                  ? `£${totalPayment.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`
                  : "–"}
              </p>
            </div>
            <div className="comparison-col">
              <h4>Scenario B</h4>
              <p>
                <strong>Monthly:</strong>{" "}
                {monthlyPaymentB > 0
                  ? `£${monthlyPaymentB.toFixed(2)}`
                  : "–"}
              </p>
              <p>
                <strong>Total interest:</strong>{" "}
                {totalInterestB > 0
                  ? `£${totalInterestB.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`
                  : "–"}
              </p>
              <p>
                <strong>Total repaid:</strong>{" "}
                {totalPaymentB > 0
                  ? `£${totalPaymentB.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`
                  : "–"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="stacked-bar-wrapper">
        <p className="stacked-label">Mortgage cost breakdown (Scenario A)</p>
        <div className="stacked-bar">
          <div
            className="stacked-bar-principal"
            style={{ width: `${principalPct || 0}%` }}
          >
            {principalPct > 10 && <span>Principal</span>}
          </div>
          <div
            className="stacked-bar-interest"
            style={{ width: `${interestPct || 0}%` }}
          >
            {interestPct > 10 && <span>Interest</span>}
          </div>
        </div>
      </div>

      {firstRows.length > 0 && (
        <div className="schedule-wrapper">
          <h3>Repayment schedule snapshot (Scenario A)</h3>
          <div className="schedule-grid">
            <div>
              <h4>First months</h4>
              <ScheduleTable rows={firstRows} />
            </div>
            <div>
              <h4>Final months</h4>
              <ScheduleTable rows={lastRows} />
            </div>
          </div>
        </div>
      )}

      <div className="explanation">
        <p>
          This is a simplified estimate based on the information you provided.
          In a real mortgage application, lenders will carry out full
          affordability checks, review your credit history, and may offer
          different products and rates.
        </p>
      </div>

      <div className="actions">
        <button onClick={prevStep}>← Back</button>
      </div>
    </section>
  );
}

function ScheduleTable({ rows }) {
  return (
    <table className="schedule-table">
      <thead>
        <tr>
          <th>Month</th>
          <th>Principal</th>
          <th>Interest</th>
          <th>Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.month}>
            <td>{row.month}</td>
            <td>
              £
              {row.principal.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </td>
            <td>
              £
              {row.interest.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </td>
            <td>
              £
              {row.balance.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default App;
