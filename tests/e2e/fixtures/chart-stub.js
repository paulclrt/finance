(() => {
  function createSeriesStub() {
    return {
      setData() {},
      applyOptions() {},
      setMarkers() {},
    };
  }

  function createChartStub() {
    return {
      addSeries() {
        return createSeriesStub();
      },
      timeScale() {
        return {
          fitContent() {},
          setVisibleRange() {},
        };
      },
      applyOptions() {},
      remove() {},
    };
  }

  window.LightweightCharts = {
    LineSeries: "LineSeries",
    HistogramSeries: "HistogramSeries",
    CandlestickSeries: "CandlestickSeries",
    createChart() {
      return createChartStub();
    },
    createSeriesMarkers() {},
  };
})();
