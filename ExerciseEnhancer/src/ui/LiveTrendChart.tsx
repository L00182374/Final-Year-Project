import React, { useMemo, useState } from "react";
import { View, Text, LayoutChangeEvent } from "react-native";
import { LineChart } from "react-native-chart-kit";

type LiveTrendChartProps = {
  hrData: Array<number | null>;
  cadenceData: Array<number | null>;
  vt1: number | null;
};

function normaliseSeries(data: Array<number | null>): number[] {
  let last = 0;

  return data.map((value) => {
    if (value == null) {
      return last;
    }

    last = value;
    return value;
  });
}

function buildFlatLine(length: number, value: number): number[] {
  return Array.from({ length }, () => value);
}

export default function LiveTrendChart({
  hrData,
  cadenceData,
  vt1,
}: LiveTrendChartProps) {
  const [innerWidth, setInnerWidth] = useState(0);

  const chartData = useMemo(() => {
    const pointCount = Math.max(hrData.length, cadenceData.length, 2);

    const labels = Array.from({ length: pointCount }, (_, index) => {
      if (index === 0) return "";
      if (index === pointCount - 1) return "Now";
      return "";
    });

    const datasets: Array<{
      data: number[];
      color: (opacity?: number) => string;
      strokeWidth: number;
    }> = [
      {
        data: normaliseSeries(hrData),
        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: normaliseSeries(cadenceData),
        color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
        strokeWidth: 2,
      },
    ];

    if (vt1 != null) {
      datasets.push({
        data: buildFlatLine(pointCount, vt1),
        color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
        strokeWidth: 2,
      });

      datasets.push({
        data: buildFlatLine(pointCount, Math.round(vt1 * 0.85)),
        color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
        strokeWidth: 2,
      });
    }

    return {
      labels,
      datasets,
    };
  }, [hrData, cadenceData, vt1]);

  function handleLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;

    setInnerWidth(Math.max(0, width - 28));
  }

  return (
    <View
      onLayout={handleLayout}
      style={{
        marginTop: 12,
        backgroundColor: "#14141c",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <Text style={{ color: "#a3a3a3" }}>Live trends</Text>

      {innerWidth > 0 ? (
        <View style={{ marginTop: 10, alignItems: "center" }}>
          <LineChart
            data={chartData}
            width={innerWidth}
            height={220}
            withDots={false}
            withShadow={false}
            withVerticalLines={false}
            withInnerLines
            withOuterLines
            withVerticalLabels={false}
            withHorizontalLabels={true}
            fromZero={false}
            bezier={false}
            chartConfig={{
              backgroundColor: "#14141c",
              backgroundGradientFrom: "#14141c",
              backgroundGradientTo: "#14141c",
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(163, 163, 163, ${opacity})`,
              strokeWidth: 2,
              propsForBackgroundLines: {
                strokeDasharray: "",
                stroke: "#20202b",
                strokeWidth: 1,
              },
              propsForLabels: {
                fontSize: 10,
              },
            }}
            style={{
              borderRadius: 12,
              alignSelf: "center",
            }}
          />
        </View>
      ) : null}

      <View
        style={{
          marginTop: 10,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "700" }}>
          HR
        </Text>
        <Text style={{ color: "#2563eb", fontSize: 12, fontWeight: "700" }}>
          Cadence
        </Text>

        {vt1 != null ? (
          <>
            <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "700" }}>
              VT1
            </Text>
            <Text style={{ color: "#f59e0b", fontSize: 12, fontWeight: "700" }}>
              Z2 low
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}
