;; ZenithPay Contract
;; Handles cross-border payments using Bitcoin

;; Constants 
(define-constant contract-owner tx-sender)
(define-constant err-unauthorized (err u100))
(define-constant err-invalid-address (err u101))
(define-constant err-channel-exists (err u102))
(define-constant err-channel-not-found (err u103))
(define-constant err-insufficient-funds (err u104))
(define-constant err-invalid-state (err u105))
(define-constant err-refund-not-allowed (err u106))

;; Data vars
(define-data-var fee-rate uint u100) ;; basis points
(define-data-var min-deposit uint u1000000) ;; in sats

;; Data maps
(define-map PaymentChannels
    { channel-id: uint }
    {
        sender: principal,
        receiver: principal,
        sender-btc-address: (string-ascii 34),
        receiver-btc-address: (string-ascii 34),
        balance: uint,
        state: (string-ascii 10),
        timeout: uint
    }
)

(define-map AddressRegistry
    principal
    (string-ascii 34)
)

;; Initialize payment channel
(define-public (create-channel (receiver principal) (initial-deposit uint))
    (let
        ((channel-id (generate-channel-id)))
        (if (and
                (>= initial-deposit (var-get min-deposit))
                (is-none (map-get? PaymentChannels { channel-id: channel-id })))
            (begin
                (try! (stx-transfer? initial-deposit tx-sender (as-contract tx-sender)))
                (map-set PaymentChannels
                    { channel-id: channel-id }
                    {
                        sender: tx-sender,
                        receiver: receiver,
                        sender-btc-address: "",
                        receiver-btc-address: "",
                        balance: initial-deposit,
                        state: "ACTIVE",
                        timeout: u0
                    }
                )
                (ok channel-id))
            err-channel-exists)
    )
)

;; Register Bitcoin address
(define-public (register-btc-address (btc-address (string-ascii 34)))
    (begin
        (asserts! (is-valid-btc-address btc-address) err-invalid-address)
        (map-set AddressRegistry tx-sender btc-address)
        (ok true)
    )
)

;; Execute payment
(define-public (execute-payment (channel-id uint) (amount uint))
    (let
        ((channel (unwrap! (map-get? PaymentChannels { channel-id: channel-id }) err-channel-not-found))
         (fee (calculate-fee amount)))
        (if (and
                (is-eq (get sender channel) tx-sender)
                (is-eq (get state channel) "ACTIVE")
                (>= (get balance channel) amount))
            (begin
                (map-set PaymentChannels
                    { channel-id: channel-id }
                    (merge channel {
                        balance: (- (get balance channel) amount),
                        state: "PENDING",
                        timeout: (+ block-height u144)
                    })
                )
                (ok true))
            err-invalid-state)
    )
)

;; Confirm payment receipt
(define-public (confirm-payment (channel-id uint))
    (let
        ((channel (unwrap! (map-get? PaymentChannels { channel-id: channel-id }) err-channel-not-found)))
        (if (and
                (is-eq (get receiver channel) tx-sender)
                (is-eq (get state channel) "PENDING"))
            (begin
                (map-set PaymentChannels
                    { channel-id: channel-id }
                    (merge channel {
                        state: "ACTIVE",
                        timeout: u0
                    })
                )
                (ok true))
            err-invalid-state)
    )
)

;; Refund expired payment
(define-public (refund-payment (channel-id uint))
    (let
        ((channel (unwrap! (map-get? PaymentChannels { channel-id: channel-id }) err-channel-not-found)))
        (if (and
                (is-eq (get sender channel) tx-sender)
                (is-eq (get state channel) "PENDING")
                (>= block-height (get timeout channel)))
            (begin
                (map-set PaymentChannels
                    { channel-id: channel-id }
                    (merge channel {
                        state: "ACTIVE",
                        timeout: u0
                    })
                )
                (ok true))
            err-refund-not-allowed)
    )
)

;; Read only functions
(define-read-only (get-channel-info (channel-id uint))
    (map-get? PaymentChannels { channel-id: channel-id })
)

(define-read-only (get-btc-address (user principal))
    (map-get? AddressRegistry user)
)

(define-read-only (calculate-fee (amount uint))
    (/ (* amount (var-get fee-rate)) u10000)
)

;; Private functions
(define-private (generate-channel-id)
    (let
        ((entropy (get-block-info? id u0)))
        (default-to u0 entropy))
)

(define-private (is-valid-btc-address (address (string-ascii 34)))
    (begin
        ;; Basic validation - should be expanded
        (and
            (is-eq (slice? address u0 u1) (some-value "1"))
            (is-eq (len address) u34))
    )
)
