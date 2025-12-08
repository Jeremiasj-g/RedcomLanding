import React from "react";
import "./DualSpinner.css";

type DualSpinnerProps = {
  size?: number;     // tamaño total (px)
  thickness?: number; // grosor del borde (px)
};

export default function DualSpinner({
  size = 40,
  thickness = 3,
}: DualSpinnerProps) {
  const innerSize = Math.round(size * 0.65); // tamaño del círculo interno

  return (
    <div className="dual-spinner-wrapper" style={{ width: size, height: size }}>
      <div
        className="dual-spinner outer"
        style={{
          width: size,
          height: size,
          borderWidth: thickness,
        }}
      ></div>

      <div
        className="dual-spinner inner"
        style={{
          width: innerSize,
          height: innerSize,
          borderWidth: thickness,
        }}
      ></div>
    </div>
  );
}