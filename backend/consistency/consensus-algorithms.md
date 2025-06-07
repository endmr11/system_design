# 4.3. Paxos ve Raft Konsensüs Algoritmaları

## Paxos

### Temel Kavramlar
- Multi-Paxos ve Single-Paxos
- Öneren (Proposer), Kabul Eden (Acceptor), Öğrenen (Learner) roller
- Promise ve Accept mesajları
- Çoğunluk oylama (quorum-based voting)

### Protokol Aşamaları

#### 1. Hazırlık Aşaması (Prepare Phase)
- Teklif numarası üretimi
- Promise istekleri
- Çoğunluk kabulü

#### 2. Kabul Aşaması (Accept Phase)
- Değer önerisi
- Accept istekleri
- Değerin taahhüdü

#### 3. Öğrenme Aşaması (Learn Phase)
- Değerin yayılması
- Durum çoğaltma
- Tutarlılığın korunması

### Kullanım Senaryoları
- Dağıtık kilitleme
- Konfigürasyon yönetimi
- Durum makinesi çoğaltma
- Lider seçimi

### Spring Boot Paxos-Tarzı Uygulama

#### Dağıtık Konfigürasyon Servisi
```java
@Component
public class PaxosStyleConfigurationService {
    
    @Autowired
    private List<ConfigurationNode> nodes;
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    private final AtomicLong proposalNumber = new AtomicLong(0);
    
    public boolean proposeConfiguration(String key, String value) {
        long currentProposal = proposalNumber.incrementAndGet();
        
        // Phase 1: Prepare
        PrepareResult prepareResult = prepare(key, currentProposal);
        if (!prepareResult.isAccepted()) {
            log.warn("Prepare phase failed for proposal: {}", currentProposal);
            return false;
        }
        
        // Use highest accepted value if exists
        String proposedValue = prepareResult.getHighestAcceptedValue() != null ? 
            prepareResult.getHighestAcceptedValue() : value;
        
        // Phase 2: Accept
        AcceptResult acceptResult = accept(key, currentProposal, proposedValue);
        if (!acceptResult.isAccepted()) {
            log.warn("Accept phase failed for proposal: {}", currentProposal);
            return false;
        }
        
        // Phase 3: Learn
        learn(key, proposedValue);
        
        return true;
    }
    
    private PrepareResult prepare(String key, long proposalNumber) {
        String promiseKey = "promise:" + key;
        String acceptedKey = "accepted:" + key;
        
        // Lua script for atomic prepare operation
        String script = """
            local promise_key = KEYS[1]
            local accepted_key = KEYS[2]
            local proposal_num = tonumber(ARGV[1])
            
            local current_promise = redis.call('get', promise_key)
            local current_accepted = redis.call('hmget', accepted_key, 'number', 'value')
            
            if current_promise == false or tonumber(current_promise) < proposal_num then
                redis.call('set', promise_key, proposal_num)
                redis.call('expire', promise_key, 300)
                
                local accepted_num = tonumber(current_accepted[1]) or 0
                local accepted_val = current_accepted[2] or ''
                
                return {1, accepted_num, accepted_val}
            else
                return {0, 0, ''}
            end
        """;
        
        List<String> keys = Arrays.asList(promiseKey, acceptedKey);
        List<String> args = Arrays.asList(String.valueOf(proposalNumber));
        
        int acceptedCount = 0;
        String highestAcceptedValue = null;
        long highestAcceptedNumber = 0;
        
        for (ConfigurationNode node : nodes) {
            try {
                List<Object> result = (List<Object>) node.getRedisTemplate()
                    .execute((RedisCallback<Object>) connection -> 
                        connection.eval(script.getBytes(), ReturnType.MULTI,
                            keys.size(), keys.toArray(new String[0]),
                            args.toArray(new String[0]))
                    );
                
                if (result != null && Long.valueOf(1).equals(result.get(0))) {
                    acceptedCount++;
                    
                    Long acceptedNum = (Long) result.get(1);
                    String acceptedVal = (String) result.get(2);
                    
                    if (acceptedNum > highestAcceptedNumber) {
                        highestAcceptedNumber = acceptedNum;
                        highestAcceptedValue = acceptedVal;
                    }
                }
            } catch (Exception e) {
                log.error("Prepare failed for node: {}", node.getId(), e);
            }
        }
        
        boolean accepted = acceptedCount > nodes.size() / 2;
        return new PrepareResult(accepted, highestAcceptedValue, highestAcceptedNumber);
    }
    
    private AcceptResult accept(String key, long proposalNumber, String value) {
        String promiseKey = "promise:" + key;
        String acceptedKey = "accepted:" + key;
        
        String script = """
            local promise_key = KEYS[1]
            local accepted_key = KEYS[2]
            local proposal_num = tonumber(ARGV[1])
            local value = ARGV[2]
            
            local current_promise = redis.call('get', promise_key)
            
            if current_promise and tonumber(current_promise) <= proposal_num then
                redis.call('hmset', accepted_key, 'number', proposal_num, 'value', value)
                redis.call('expire', accepted_key, 300)
                return 1
            else
                return 0
            end
        """;
        
        List<String> keys = Arrays.asList(promiseKey, acceptedKey);
        List<String> args = Arrays.asList(String.valueOf(proposalNumber), value);
        
        int acceptedCount = 0;
        
        for (ConfigurationNode node : nodes) {
            try {
                Long result = (Long) node.getRedisTemplate()
                    .execute((RedisCallback<Long>) connection -> 
                        connection.eval(script.getBytes(), ReturnType.INTEGER,
                            keys.size(), keys.toArray(new String[0]),
                            args.toArray(new String[0]))
                    );
                
                if (Long.valueOf(1).equals(result)) {
                    acceptedCount++;
                }
            } catch (Exception e) {
                log.error("Accept failed for node: {}", node.getId(), e);
            }
        }
        
        boolean accepted = acceptedCount > nodes.size() / 2;
        return new AcceptResult(accepted, acceptedCount);
    }
    
    private void learn(String key, String value) {
        // Broadcast learned value to all nodes
        String learnedKey = "config:" + key;
        
        for (ConfigurationNode node : nodes) {
            CompletableFuture.runAsync(() -> {
                try {
                    node.getRedisTemplate().opsForValue().set(learnedKey, value);
                    log.info("Configuration learned on node {}: {} = {}", 
                        node.getId(), key, value);
                } catch (Exception e) {
                    log.error("Learn failed for node: {}", node.getId(), e);
                }
            });
        }
    }
    
    // Helper classes
    public static class PrepareResult {
        private final boolean accepted;
        private final String highestAcceptedValue;
        private final long highestAcceptedNumber;
        
        public PrepareResult(boolean accepted, String highestAcceptedValue, 
                           long highestAcceptedNumber) {
            this.accepted = accepted;
            this.highestAcceptedValue = highestAcceptedValue;
            this.highestAcceptedNumber = highestAcceptedNumber;
        }
        
        // Getters...
        public boolean isAccepted() { return accepted; }
        public String getHighestAcceptedValue() { return highestAcceptedValue; }
        public long getHighestAcceptedNumber() { return highestAcceptedNumber; }
    }
    
    public static class AcceptResult {
        private final boolean accepted;
        private final int acceptedCount;
        
        public AcceptResult(boolean accepted, int acceptedCount) {
            this.accepted = accepted;
            this.acceptedCount = acceptedCount;
        }
        
        public boolean isAccepted() { return accepted; }
        public int getAcceptedCount() { return acceptedCount; }
    }
}

@Component
public class ConfigurationNode {
    
    private final String id;
    private final RedisTemplate<String, Object> redisTemplate;
    
    public ConfigurationNode(@Value("${node.id}") String id,
                           RedisTemplate<String, Object> redisTemplate) {
        this.id = id;
        this.redisTemplate = redisTemplate;
    }
    
    public String getId() { return id; }
    public RedisTemplate<String, Object> getRedisTemplate() { return redisTemplate; }
}
```

## Raft

### Temel Bileşenler

#### Lider Seçimi (Leader Election)
- Dönem tabanlı oylama
- Heartbeat mekanizması
- Zaman aşımı yönetimi
- Log tutarlılık kontrolü

#### Log Çoğaltma (Log Replication)
- Sadece ekleme yapılan log
- Log eşleşme özelliği
- Log sıkıştırma
- Snapshot mekanizması

#### Güvenlik Mekanizmaları
- Sadece lider güncelleyebilir
- Log tutarlılığı
- Dönem doğrulama
- Çakışma çözümü

### Uygulama Örnekleri

#### etcd
- Anahtar-değer deposu
- İzleme mekanizması
- Kira sistemi (lease system)
- Dağıtık kilitleme

#### Consul
- Servis keşfi
- Sağlık kontrolü
- Anahtar-değer deposu
- Dağıtık kilitleme

#### Kubernetes
- etcd entegrasyonu
- Durum yönetimi
- Konfigürasyon saklama
- Lider seçimi

### Spring Boot Raft-Tarzı Uygulama

#### Dağıtık Durum Makinesi
```java
@Component
public class RaftStyleStateMachine {
    
    private final String nodeId;
    private final List<RaftNode> cluster;
    private volatile RaftState state = RaftState.FOLLOWER;
    private volatile String currentLeader;
    private volatile long currentTerm = 0;
    private volatile String votedFor;
    
    private final List<LogEntry> log = new CopyOnWriteArrayList<>();
    private volatile long commitIndex = 0;
    private volatile long lastApplied = 0;
    
    // Leader state
    private final Map<String, Long> nextIndex = new ConcurrentHashMap<>();
    private final Map<String, Long> matchIndex = new ConcurrentHashMap<>();
    
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(3);
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    public RaftStyleStateMachine(@Value("${raft.node.id}") String nodeId,
                               List<RaftNode> cluster) {
        this.nodeId = nodeId;
        this.cluster = cluster;
        startElectionTimer();
    }
    
    @PostConstruct
    public void initialize() {
        // Initialize leader state for all nodes
        for (RaftNode node : cluster) {
            nextIndex.put(node.getId(), log.size() + 1);
            matchIndex.put(node.getId(), 0L);
        }
    }
    
    // Leader Election
    public void startElection() {
        synchronized (this) {
            state = RaftState.CANDIDATE;
            currentTerm++;
            votedFor = nodeId;
            
            log.info("Node {} starting election for term {}", nodeId, currentTerm);
        }
        
        int votes = 1; // Vote for self
        long lastLogIndex = log.size();
        long lastLogTerm = lastLogIndex > 0 ? log.get((int) lastLogIndex - 1).getTerm() : 0;
        
        List<CompletableFuture<Boolean>> voteRequests = new ArrayList<>();
        
        for (RaftNode node : cluster) {
            if (!node.getId().equals(nodeId)) {
                CompletableFuture<Boolean> voteRequest = CompletableFuture.supplyAsync(() ->
                    requestVote(node, currentTerm, lastLogIndex, lastLogTerm)
                );
                voteRequests.add(voteRequest);
            }
        }
        
        // Wait for vote responses
        CompletableFuture.allOf(voteRequests.toArray(new CompletableFuture[0]))
            .thenRun(() -> {
                long receivedVotes = voteRequests.stream()
                    .mapToLong(future -> {
                        try {
                            return future.get() ? 1 : 0;
                        } catch (Exception e) {
                            return 0;
                        }
                    })
                    .sum() + 1; // +1 for self vote
                
                if (receivedVotes > cluster.size() / 2) {
                    becomeLeader();
                } else {
                    becomeFollower();
                }
            });
    }
    
    private boolean requestVote(RaftNode node, long term, long lastLogIndex, long lastLogTerm) {
        try {
            VoteRequest request = new VoteRequest(nodeId, term, lastLogIndex, lastLogTerm);
            VoteResponse response = node.requestVote(request);
            
            if (response.getTerm() > currentTerm) {
                synchronized (this) {
                    currentTerm = response.getTerm();
                    votedFor = null;
                    becomeFollower();
                }
                return false;
            }
            
            return response.isVoteGranted();
            
        } catch (Exception e) {
            log.error("Vote request failed for node: {}", node.getId(), e);
            return false;
        }
    }
    
    public VoteResponse handleVoteRequest(VoteRequest request) {
        synchronized (this) {
            if (request.getTerm() < currentTerm) {
                return new VoteResponse(currentTerm, false);
            }
            
            if (request.getTerm() > currentTerm) {
                currentTerm = request.getTerm();
                votedFor = null;
                becomeFollower();
            }
            
            boolean logUpToDate = isLogUpToDate(request.getLastLogIndex(), request.getLastLogTerm());
            
            if ((votedFor == null || votedFor.equals(request.getCandidateId())) && logUpToDate) {
                votedFor = request.getCandidateId();
                resetElectionTimer();
                return new VoteResponse(currentTerm, true);
            }
            
            return new VoteResponse(currentTerm, false);
        }
    }
    
    private boolean isLogUpToDate(long lastLogIndex, long lastLogTerm) {
        if (log.isEmpty()) {
            return true;
        }
        
        LogEntry lastEntry = log.get(log.size() - 1);
        
        if (lastLogTerm > lastEntry.getTerm()) {
            return true;
        }
        
        return lastLogTerm == lastEntry.getTerm() && lastLogIndex >= log.size();
    }
    
    // Log Replication
    private void becomeLeader() {
        synchronized (this) {
            state = RaftState.LEADER;
            currentLeader = nodeId;
            
            // Initialize leader state
            for (RaftNode node : cluster) {
                nextIndex.put(node.getId(), log.size() + 1);
                matchIndex.put(node.getId(), 0L);
            }
        }
        
        log.info("Node {} became leader for term {}", nodeId, currentTerm);
        
        // Start sending heartbeats
        startHeartbeat();
    }
    
    private void startHeartbeat() {
        scheduler.scheduleWithFixedDelay(() -> {
            if (state == RaftState.LEADER) {
                sendHeartbeats();
            }
        }, 0, 50, TimeUnit.MILLISECONDS); // 50ms heartbeat interval
    }
    
    private void sendHeartbeats() {
        for (RaftNode node : cluster) {
            if (!node.getId().equals(nodeId)) {
                CompletableFuture.runAsync(() -> sendAppendEntries(node));
            }
        }
    }
    
    private void sendAppendEntries(RaftNode node) {
        long prevLogIndex = nextIndex.get(node.getId()) - 1;
        long prevLogTerm = prevLogIndex > 0 ? log.get((int) prevLogIndex - 1).getTerm() : 0;
        
        List<LogEntry> entries = new ArrayList<>();
        if (nextIndex.get(node.getId()) <= log.size()) {
            entries = log.subList((int) (nextIndex.get(node.getId()) - 1), log.size());
        }
        
        AppendEntriesRequest request = new AppendEntriesRequest(
            currentTerm, nodeId, prevLogIndex, prevLogTerm, entries, commitIndex
        );
        
        try {
            AppendEntriesResponse response = node.appendEntries(request);
            
            if (response.getTerm() > currentTerm) {
                synchronized (this) {
                    currentTerm = response.getTerm();
                    becomeFollower();
                }
                return;
            }
            
            if (response.isSuccess()) {
                // Update nextIndex and matchIndex
                nextIndex.put(node.getId(), prevLogIndex + entries.size() + 1);
                matchIndex.put(node.getId(), prevLogIndex + entries.size());
                
                // Update commit index
                updateCommitIndex();
            } else {
                // Decrement nextIndex and retry
                nextIndex.put(node.getId(), Math.max(1, nextIndex.get(node.getId()) - 1));
            }
            
        } catch (Exception e) {
            log.error("AppendEntries failed for node: {}", node.getId(), e);
        }
    }
    
    public AppendEntriesResponse handleAppendEntries(AppendEntriesRequest request) {
        resetElectionTimer();
        
        synchronized (this) {
            if (request.getTerm() < currentTerm) {
                return new AppendEntriesResponse(currentTerm, false);
            }
            
            if (request.getTerm() > currentTerm) {
                currentTerm = request.getTerm();
                votedFor = null;
            }
            
            becomeFollower();
            currentLeader = request.getLeaderId();
            
            // Log consistency check
            if (request.getPrevLogIndex() > 0) {
                if (log.size() < request.getPrevLogIndex() ||
                    log.get((int) request.getPrevLogIndex() - 1).getTerm() != request.getPrevLogTerm()) {
                    return new AppendEntriesResponse(currentTerm, false);
                }
            }
            
            // Append entries
            if (!request.getEntries().isEmpty()) {
                // Remove conflicting entries
                if (log.size() > request.getPrevLogIndex()) {
                    log.subList((int) request.getPrevLogIndex(), log.size()).clear();
                }
                
                // Append new entries
                log.addAll(request.getEntries());
            }
            
            // Update commit index
            if (request.getLeaderCommit() > commitIndex) {
                commitIndex = Math.min(request.getLeaderCommit(), log.size());
                applyLogEntries();
            }
            
            return new AppendEntriesResponse(currentTerm, true);
        }
    }
    
    private void updateCommitIndex() {
        if (state != RaftState.LEADER) return;
        
        for (long index = commitIndex + 1; index <= log.size(); index++) {
            long replicationCount = 1; // Leader itself
            
            for (RaftNode node : cluster) {
                if (!node.getId().equals(nodeId) && matchIndex.get(node.getId()) >= index) {
                    replicationCount++;
                }
            }
            
            if (replicationCount > cluster.size() / 2 && 
                log.get((int) index - 1).getTerm() == currentTerm) {
                commitIndex = index;
            }
        }
        
        applyLogEntries();
    }
    
    private void applyLogEntries() {
        while (lastApplied < commitIndex) {
            lastApplied++;
            LogEntry entry = log.get((int) lastApplied - 1);
            applyToStateMachine(entry);
        }
    }
    
    private void applyToStateMachine(LogEntry entry) {
        // Apply command to state machine
        log.info("Applying log entry: {}", entry.getCommand());
        
        // Store in Redis for persistence
        String key = "state:" + entry.getCommand().getKey();
        redisTemplate.opsForValue().set(key, entry.getCommand().getValue());
    }
    
    // Client operations
    public boolean submitCommand(Command command) {
        if (state != RaftState.LEADER) {
            log.warn("Not leader, cannot submit command");
            return false;
        }
        
        LogEntry entry = new LogEntry(currentTerm, command);
        
        synchronized (this) {
            log.add(entry);
        }
        
        // Replicate to followers
        sendHeartbeats();
        
        return true;
    }
    
    private void becomeFollower() {
        state = RaftState.FOLLOWER;
        currentLeader = null;
        resetElectionTimer();
    }
    
    private void startElectionTimer() {
        scheduler.schedule(() -> {
            if (state != RaftState.LEADER) {
                startElection();
            }
        }, getRandomElectionTimeout(), TimeUnit.MILLISECONDS);
    }
    
    private void resetElectionTimer() {
        startElectionTimer();
    }
    
    private long getRandomElectionTimeout() {
        return 150 + (long) (Math.random() * 150); // 150-300ms
    }
    
    // Helper classes and enums
    public enum RaftState {
        FOLLOWER, CANDIDATE, LEADER
    }
    
    public static class LogEntry {
        private final long term;
        private final Command command;
        
        public LogEntry(long term, Command command) {
            this.term = term;
            this.command = command;
        }
        
        public long getTerm() { return term; }
        public Command getCommand() { return command; }
    }
    
    public static class Command {
        private final String key;
        private final String value;
        
        public Command(String key, String value) {
            this.key = key;
            this.value = value;
        }
        
        public String getKey() { return key; }
        public String getValue() { return value; }
    }
    
    // Request/Response classes would be defined here...
}
```

### Karşılaştırma

#### Paxos
- Daha karmaşık protokol
- Optimize edilmiş mesaj sayısı
- Daha esnek yapı
- Zor uygulama

#### Raft
- Daha basit protokol
- Daha fazla mesaj trafiği
- Daha anlaşılır yapı
- Kolay uygulama

### Spring Boot ile Konsensüs Servisi
```java
@Service
public class ConsensusService {
    
    @Autowired
    private RaftStyleStateMachine raftStateMachine;
    
    @Autowired
    private PaxosStyleConfigurationService paxosService;
    
    public boolean distributeConfiguration(String key, String value, 
                                         ConsensusAlgorithm algorithm) {
        switch (algorithm) {
            case RAFT:
                Command command = new Command(key, value);
                return raftStateMachine.submitCommand(command);
                
            case PAXOS:
                return paxosService.proposeConfiguration(key, value);
                
            default:
                throw new IllegalArgumentException("Unsupported algorithm: " + algorithm);
        }
    }
    
    public enum ConsensusAlgorithm {
        RAFT, PAXOS
    }
}
```

Bu uygulamalar, Paxos ve Raft algoritmalarının temel konseptlerini Spring Boot ekosisteminde nasıl uygulayabileceğinizi göstermektedir.
