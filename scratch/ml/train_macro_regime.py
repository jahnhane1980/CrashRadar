"""
Prototyp-Training für das Multivariate Makro-ML-Regime-Modell
CrashRadar - Phase 7 (docs/Makro-ML.md)

Liest data/historical_events_raw_indicators.csv ein, trainiert ein XGBoost-Modell
und exportiert die JSON-Bäume für die Node.js-Inferenz.
"""

import os
import json
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import classification_report, roc_auc_score, brier_score_loss

def load_and_preprocess_data(csv_path: str):
    df = pd.read_csv(csv_path)
    print(f"[Dataset] {len(df)} Zeilen aus {csv_path} geladen.")
    print(f"[Events] Enthaltene Crash-Events: {len(df['Event_Name'].unique())} historische Phasen")

    # 1. Ziel-Variable definieren:
    # 1 = Akute Gefahren-/Crash-Zone (CRASH_PHASE oder BOTTOM_ZONE), 0 = Normal/Rebound
    df['target_crash_risk'] = df['Event_Phase'].apply(
        lambda p: 1 if p in ['CRASH_PHASE', 'BOTTOM_ZONE'] else 0
    )
    
    # 2. Relevante numerische Features (Makro-Plumbing, Zinsen, Flow, Liquiditaet)
    candidate_features = [
        'Spread_10Y_2Y_Current', 'Spread_10Y_2Y_Delta30d', 'Spread_10Y_3M_Current',
        'FedFundsRate_DFF', 'RealYield_10Y_DFII10', 'RealYield_10Y_Delta60d',
        'BankReserves_TOTRESNS_B', 'WRESBAL_Delta56d_B',
        'TGA_Balance_B', 'TGA_Delta90d_B', 'TGA_Delta30d_B',
        'ReverseRepo_RRPONTSYD_B', 'ReverseRepo_Delta30d_B',
        'FedBalance_WALCL_B', 'FedBalance_WALCL_Delta14d_B',
        'EmergencyBorrowing_BORROW_B', 'EmergencyBorrowing_Delta28d_B',
        'MaturityWall_Pct_M2', 'MarginDebt_Amount_M', 'MarginDebt_Drawdown180d_Pct',
        'ChicagoFed_NFCI', 'HighYieldSpread_Pct',
        'SKEW_Index', 'AAII_BullBear_Spread_Pct', 'DIX_DarkPool_Pct',
        'SPY_ShortVolumeRatio_Pct', 'Total_PutCall_Ratio_PCR',
        'Challenger_JobCuts', 'Challenger_Delta_SMA6_Pct',
        'Labor_PAYEMS_Delta3M', 'Labor_CE16OV_Delta3M',
        'Gold_Close', 'GDX_Close', 'DXY_Close'
    ]

    feature_cols = [c for c in candidate_features if c in df.columns]
    X = df[feature_cols].copy()
    y = df['target_crash_risk'].copy()

    # Fehlende Werte (NaN) werden von XGBoost nativ gehandhabt
    print(f"[Features] {len(feature_cols)} Eingabe-Features ausgewählt.")
    return df, X, y, feature_cols

def train_macro_model(df: pd.DataFrame, X: pd.DataFrame, y: pd.Series, feature_cols: list):
    print("\n" + "="*60)
    print("XGBOOST TRAINING: MAKRO-REGIME CLASSIFIER")
    print("="*60)

    # Gradient Boosted Trees konfigurieren
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric='logloss',
        random_state=42
    )

    model.fit(X, y)

    # Vorhersagen & Wahrscheinlichkeiten
    preds_proba = model.predict_proba(X)[:, 1]
    preds_binary = (preds_proba >= 0.5).astype(int)

    roc_auc = float(roc_auc_score(y, preds_proba))
    brier = float(brier_score_loss(y, preds_proba))

    print(f"\n[Performance-Metriken]")
    print(f"  * ROC-AUC Score: {roc_auc:.4f} (Perfekte Trennschärfe: 1.00)")
    print(f"  * Brier Score:   {brier:.4f} (Niedriger ist besser, optimal < 0.10)")
    print("\nKlassifikations-Bericht:")
    print(classification_report(y, preds_binary, target_names=['Normal/Rebound', 'Crash/Gefahrenzone']))

    # Feature Importance (Gain & Weight)
    importances = model.feature_importances_
    sorted_indices = np.argsort(importances)[::-1]

    print("--- TOP 10 EINFLUSSREICHSTE MAKRO-FEATURES ---")
    top_features = []
    for rank, idx in enumerate(sorted_indices[:10], start=1):
        feat_name = feature_cols[idx]
        score = float(importances[idx])
        top_features.append({"rank": rank, "feature": feat_name, "importance_pct": round(score * 100, 2)})
        print(f"  {rank:2d}. {feat_name:<34} : {score * 100:6.2f} %")

    # Modell als JSON für Node.js exportieren
    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "ml", "models", "macro_regime")
    os.makedirs(output_dir, exist_ok=True)

    model_json_path = os.path.join(output_dir, "macro_regime_model.json")
    model.save_model(model_json_path)
    print(f"\n[Modell-Export] XGBoost-Bäume gespeichert nach: {model_json_path}")

    # Metadaten für Node.js Inferenz exportieren
    meta_path = os.path.join(output_dir, "macro_regime_meta.json")
    meta = {
        "model_name": "macro_regime_v1",
        "algorithm": "XGBoost Gradient Boosted Trees",
        "target": "Crash / High Risk Regime Probability (0-100%)",
        "feature_count": len(feature_cols),
        "features": feature_cols,
        "metrics": {
            "roc_auc": round(roc_auc, 4),
            "brier_score": round(brier, 4)
        },
        "top_drivers": top_features
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"[Metadaten-Export] Meta-Informationen gespeichert nach: {meta_path}")

    return model

if __name__ == "__main__":
    csv_file = os.path.join(os.path.dirname(__file__), "..", "..", "data", "historical_events_raw_indicators.csv")
    if not os.path.exists(csv_file):
        print(f"Fehler: CSV {csv_file} existiert nicht!")
        exit(1)

    df, X, y, feature_cols = load_and_preprocess_data(csv_file)
    train_macro_model(df, X, y, feature_cols)
