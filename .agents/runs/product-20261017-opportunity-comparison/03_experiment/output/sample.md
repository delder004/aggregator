# Before buying an AI accounting course, try one real task

Can you spot what is wrong with a plausible AI-generated cash summary?

This is a short fictional practice exercise. The draft was deliberately constructed by an AI assistant to contain errors; it is not a benchmark of any model's normal accuracy. No software or accounting qualification is needed. No certificate is offered.

## The source

A fictional studio has one bank account. The opening balance is **$2,000**. The following are all its posted bank movements for the period. Each row is a separate movement; use its ID to track it. Positive amounts add cash; negative amounts subtract cash.

| ID | Description | Signed amount |
|---|---|---:|
| B01 | Customer payment | +$1,200 |
| B02 | Rent payment | −$600 |
| B03 | Software subscription | −$90 |
| B04 | Refund paid to customer | −$150 |
| B05 | Customer payment | +$800 |
| B06 | Supplies payment | −$160 |

Do not infer revenue, profit, tax treatment or unpaid invoices from these descriptions. The task is only to summarize these bank movements.

## The draft to review

> Receipts are $2,150: B01 $1,200, B04 $150 and B05 $800.
>
> Payments are $1,010: B02 $600, B03 $90, B06 $160 and B06 $160.
>
> Net cash movement is +$1,140. Closing cash is $3,140.
>
> All six source rows were included once. No exceptions remain.

## Your task

Before looking at the worked answer:
1. Identify two problems, using source IDs.
2. Calculate receipts, payments, net movement and closing cash.
3. Write one sentence explaining why correct arithmetic inside a draft is not enough.

If you received this through LinkedIn, reply with your source IDs and numbers. You may give a partial answer. Please use only this fictional data.

---

## Worked answer — read after trying

**B04 has the wrong direction.** It is cash paid out, so it belongs with payments, not receipts.

**B06 appears twice.** The source has one B06 movement. The claim that every row appears once is false.

| Check | Calculation | Result |
|---|---|---:|
| Receipts | 1,200 + 800 | $2,000 |
| Payments | 600 + 90 + 150 + 160 | $1,000 |
| Net movement | 2,000 − 1,000 | +$1,000 |
| Closing cash | 2,000 opening + 1,000 net | $3,000 |

The draft's arithmetic is internally consistent, but its inputs are wrong. Misclassifying the $150 refund overstates net cash by $300: it adds $150 instead of subtracting $150. Duplicating the $160 payment understates net cash by $160. Combined, the draft overstates closing cash by $140.

A useful review checks source coverage, duplicate IDs, signs and amounts before accepting totals. An account balance or independent statement would add another check in real work; this fictional exercise supplies no independent closing statement.

## Finish

After reviewing the answer, reply with:
- One thing you corrected or confirmed.
- Would you use another exercise like this? If yes, request **another exercise** and choose: duplicate transactions, missing evidence, or explaining a cash movement.

No call is needed. Your answer is optional; this pilot tests whether the exercise is useful. Replies will be summarized without your name. The offer concerns an exercise series, not an accredited course.

