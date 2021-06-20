import React, { useEffect } from 'react';
import { extent, max, bisector, min } from 'd3-array'
import _ from 'lodash'
import { Group } from '@visx/group'
import { GridRows, GridColumns } from '@visx/grid'
import { Bar, Line } from '@visx/shape'
import moment from 'moment'
import 'moment/locale/th'
import { localPoint } from '@visx/event'
import { scaleLinear, scaleBand, scaleTime } from '@visx/scale'
import { useTooltip, Tooltip, defaultStyles, TooltipWithBounds } from '@visx/tooltip'
import { curveStepAfter } from '@visx/curve'
import { LinePath, SplitLinePath } from '@visx/shape'
import { ParentSize, withParentSize } from '@visx/responsive'
import data from '../gis/data/manufacturer-vaccination-data.json'
import { Text } from '@visx/text'
import { AxisBottom, AxisLeft } from '@visx/axis'
import * as d3 from 'd3';

function movingAvg(ts, id) {
    var moving_aves = []
    var ys = []
    for (var i = 0; i < ts.length; i++) {
        ys.push(ts[i][id])
    }
    for (var i = 0; i < ys.length; i++) {
        if (i >= 7) {
            const cosum = ys.slice(i - 7, i)
            moving_aves.push(cosum.reduce((a, b) => a + b, 0) / 7)
        }
        else {
            moving_aves.push(0)
        }
    }
    return moving_aves
}

function Curve(props) {
    const { width, height } = props
    var vaxRate = []
    const dateRange = d3.timeDays(new Date(2021, 3, 1), new Date());

    dateRange.map((date, index) => {
        const supply = _.filter(data, { "date": moment(date).format("YYYY-MM-DD") })
        var total
        if (supply.length > 1) {
            total = supply.reduce((a, b) => a["doses_administered"] + b["doses_administered"])
        }
        else {
            total = supply.doses_administered
        }
        vaxRate.push({
            date: date,
            doses_administered: total ? total : 0
        })
    })
    const x = d => d['date']
    const y = d => d["doses_administered"]
    const xScale = scaleBand({
        range: [0, width],
        domain: vaxRate.map(x),
        padding: 0.07
    })
    const dateScale = scaleTime({
        range: [0, width],
        domain: extent(vaxRate, x),
        padding: 0.07
    })
    const yScale = scaleLinear({
        range: [height, 50],
        domain: [0, max(vaxRate, y)],
    })
    var avgs = movingAvg(vaxRate, "doses_administered")
    avgs.map((avg, i) => {
        vaxRate[i]['moving_avg'] = avg
    })
    const {
        showTooltip,
        hideTooltip,
        tooltipOpen,
        tooltipData,
        tooltipLeft = 0,
        tooltipTop = 0,
    } = useTooltip({
        tooltipOpen: true,
        tooltipData: null,
    });
    const bisectDate = bisector(d => new Date(d['date'])).center;

    return (
        <div className='no-select' style={{ position: 'relative' }}>
            <svg width={width} height={height}>
                <Group>
                    <Group>
                        {vaxRate.map((d, i) => {
                            const barHeight = height - yScale(y(d))
                            return (
                                <Bar
                                    key={i}
                                    x={xScale(x(d))}
                                    y={height - barHeight - 30}
                                    width={xScale.bandwidth()}
                                    height={barHeight}
                                    fill={'#9dbbb2'}
                                />

                            );
                        })}
                    </Group>
                    <Group>
                        <LinePath
                            curve={curveStepAfter}
                            data={vaxRate}
                            x={d => xScale(x(d))}
                            y={d => (yScale(d["moving_avg"]) - 30)}
                            stroke='#427165'
                            strokeWidth={2}
                        />
                        <circle
                            cx={xScale(x(vaxRate[vaxRate.length - 1]))}
                            cy={yScale(vaxRate[vaxRate.length - 1]["moving_avg"]) - 33}
                            r={4}
                            fill='#427165'
                        />
                    </Group>
                    {tooltipData &&
                        <Bar
                            x={xScale(x(tooltipData))}
                            y={yScale(y(tooltipData)) - 30}
                            width={xScale.bandwidth()}
                            height={height - yScale(y(tooltipData))}
                            fill='#7ea297'
                        />
                    }
                    <Bar
                        onMouseMove={(e) => {
                            const x = localPoint(e)['x']
                            if (x) {
                                const x0 = dateScale.invert(x)
                                const index = bisectDate(vaxRate, x0, 1)
                                const d = vaxRate[index]
                                if (d) {
                                    const barHeight = (height - yScale(y(d)) ?? 0)
                                    showTooltip({
                                        tooltipData: d,
                                        tooltipLeft: x,
                                        tooltipTop: height - barHeight - 100
                                    })
                                }
                            }
                        }}
                        onMouseLeave={() => hideTooltip()}
                        x={10}
                        y={0}
                        width={width}
                        height={height - 30}
                        fill="transparent"
                    />
                </Group>
                {props.estimation &&

                    <Group>
                        <Text
                            x={width - 160}
                            y={yScale(parseInt(props.estimation["required_rate"])) - 30}
                            fill='#bdbdbd'
                            dx={10}
                            dy={14}
                            width={300}
                            lineHeight={18}
                            textAnchor="end"
                            fontFamily="Sarabun"
                            fontWeight="bold"
                            fontSize={14}
                        >
                            {`เพื่อให้ตามเป้าหมาย ต่อไปนี้ต้องฉีดวัคซีนให้ได้ ${parseInt(props.estimation["required_rate"]).toLocaleString()} โดส/วัน`}
                        </Text>
                        <Line
                            from={{
                                x: width - 140,
                                y: yScale(parseInt(props.estimation["required_rate"])) - 30
                            }}
                            to={{
                                x: width,
                                y: yScale(parseInt(props.estimation["required_rate"])) - 30
                            }}
                            fill="white"
                            stroke="#bfbfbf"
                            strokeWidth={2}
                            strokeDasharray="3,4"
                        />
                    </Group>
                }
                <Group>
                    <GridRows
                        scale={yScale}
                        width={width}
                        top={-30}
                        left={0}
                        strokeDasharray="1,5"
                        stroke={"#fff"}
                        strokeOpacity={0.3}
                        pointerEvents="none"
                        numTicks={4}
                    />
                    <AxisLeft
                        scale={yScale}
                        tickLabelProps={() => ({
                            fill: '#bfbfbf',
                            fontSize: 11,
                            textAnchor: 'left',
                            opacity: 0.7
                        })}
                        tickFormat={d => d > 0 ? d.toLocaleString() : ""}

                        numTicks={4}
                        top={-35}
                        left={0}
                        tickLength={0}
                    />
                    <AxisBottom
                        numTicks={3}
                        top={height - 30}
                        scale={dateScale}
                        tickFormat={d => moment(d).format('MMM')}
                        tickStroke='#bfbfbf'
                        stroke='#bfbfbf'
                        tickLabelProps={() => ({
                            fill: '#bfbfbf',
                            fontSize: 11,
                            textAnchor: 'start'
                        })}
                    />
                </Group>
            </svg>
            <div>
                {tooltipData &&

                    <TooltipWithBounds
                        top={tooltipTop}
                        left={tooltipLeft}
                        style={{
                            ...defaultStyles,
                            minWidth: 160,
                            textAlign: 'start',
                            padding: 12,
                        }}
                    >
                        <span>
                            <b>{moment(tooltipData['date']).format('DD MMM')}</b><br />
                            ฉีดวัคซีนไป {tooltipData['doses_administered'].toLocaleString()} โดส<br />
                            {tooltipData["moving_avg"] ? `ค่าเฉลี่ย 7 วัน ${Math.floor(tooltipData["moving_avg"]).toLocaleString()} โดส` : ""}

                        </span>
                    </TooltipWithBounds>
                }
            </div>
        </div>
    )

}

const VaccinationRate = (props) => (
    <div>
        <ParentSize>
            {({ width, height }) => (
                <Curve estimation={props.estimation} width={width} height={350} />
            )}
        </ParentSize>
    </div>

)
export default VaccinationRate